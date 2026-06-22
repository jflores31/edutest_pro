"""
EduTest Pro — ImportService
============================
Servicio de importación masiva de preguntas desde archivos CSV y XLSX.

Responsabilidades:
    - Parsear archivos CSV y XLSX con manejo de errores de formato.
    - Validar cada fila de forma estricta: si una fila falla, TODO falla.
    - Construir y persistir objetos Question con transacciones atómicas.
    - Soportar modo dry_run para validación sin persistencia.
    - Registrar el proceso en ImportJob para rastreo asíncrono.

Flujo principal:
    1. validate_file()  → detecta errores de estructura y contenido.
    2. process_file()   → valida + persiste en una transacción atómica.
    3. dry_run()        → equivale a validate_file() con resultado enriquecido.

Dependencias:
    - openpyxl >= 3.1   (XLSX parsing — más liviano que pandas para este caso)
    - Django ORM        (persistencia)
    - logging           (auditoría)
"""

import csv
import io
import logging
import os
import unicodedata
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO, Any, Iterator

import openpyxl
from django.db import transaction
from django.utils import timezone

from apps.exams.models import ImportJob, Organization, Question, User
from .exceptions import (
    ImportFileFormatError,
    ImportFileTooLargeError,
    ImportValidationError,
)

logger = logging.getLogger("edutest.import")

# ---------------------------------------------------------------------------
# Constantes de configuración
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS: frozenset[str] = frozenset({"text", "correct_answer"})
OPTIONAL_COLUMNS: frozenset[str] = frozenset({"option_a", "option_b", "option_c", "option_d", "option_e", "category", "explanation", "type"})
ALL_KNOWN_COLUMNS: frozenset[str] = REQUIRED_COLUMNS | OPTIONAL_COLUMNS

def _strip_accents(text: str) -> str:
    """Quita tildes/diacríticos para comparaciones robustas (á→a, ñ→n)."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", str(text or ""))
        if not unicodedata.combining(c)
    )


# Mapa de nombres en español → nombres internos (minúscula normalizada).
# El matching es insensible a acentos (ver _normalize_header), así que basta
# con listar la forma sin tilde; se dejan algunas con tilde por claridad.
COLUMN_ALIASES: dict[str, str] = {
    # Enunciado
    "pregunta": "text", "enunciado": "text", "texto": "text",
    "pregunta/enunciado": "text",
    # Opciones / alternativas A–E
    "opcion a": "option_a", "opción a": "option_a", "alternativa a": "option_a", "a": "option_a",
    "opcion b": "option_b", "opción b": "option_b", "alternativa b": "option_b", "b": "option_b",
    "opcion c": "option_c", "opción c": "option_c", "alternativa c": "option_c", "c": "option_c",
    "opcion d": "option_d", "opción d": "option_d", "alternativa d": "option_d", "d": "option_d",
    "opcion e": "option_e", "opción e": "option_e", "alternativa e": "option_e", "e": "option_e",
    # Respuesta correcta
    "respuesta correcta": "correct_answer", "respuesta": "correct_answer",
    "respuestas correctas": "correct_answer", "correcta": "correct_answer",
    "correctas": "correct_answer", "clave": "correct_answer", "answer": "correct_answer",
    # Explicación
    "explicacion": "explanation", "explicación": "explanation",
    "justificacion": "explanation", "retroalimentacion": "explanation",
    "explanation": "explanation",
    # Tema / categoría
    "tema": "category", "topic": "category", "categoria": "category",
    "categoría": "category", "materia": "category", "asignatura": "category",
    "unidad": "category",
    # Tipo (opcional)
    "tipo": "type", "tipo de pregunta": "type", "type": "type",
}
# Versión sin acentos para matching insensible a tildes.
_COLUMN_ALIASES_NOACCENT: dict[str, str] = {
    _strip_accents(k): v for k, v in COLUMN_ALIASES.items()
}


def _normalize_header(raw: str) -> str:
    """Normaliza una cabecera (sin tildes, minúscula, espacios colapsados) y la
    traduce a la clave interna vía COLUMN_ALIASES. Si no hay alias, devuelve la
    forma normalizada tal cual."""
    norm = " ".join(_strip_accents(str(raw or "")).strip().lower().split())
    return _COLUMN_ALIASES_NOACCENT.get(norm, norm)

VALID_QUESTION_TYPES: frozenset[str] = frozenset(
    v for v in Question.QuestionType.values
)

# Sinónimos de tipo (español / lenguaje natural) → enum del modelo.
# Nota: "opción única/normal" y "opción múltiple" son el MISMO tipo del modelo
# (MULTIPLE_CHOICE); la diferencia única vs múltiple la da el nº de respuestas
# correctas (una letra = única; varias como "A,C" = múltiple).
_QUESTION_TYPE_SYNONYMS: dict[str, str] = {
    # Verdadero / Falso
    "boolean": "BOOLEAN", "booleano": "BOOLEAN", "bool": "BOOLEAN",
    "true/false": "BOOLEAN", "true false": "BOOLEAN", "tf": "BOOLEAN",
    "verdadero/falso": "BOOLEAN", "verdadero falso": "BOOLEAN",
    "verdadero o falso": "BOOLEAN", "verdadero-falso": "BOOLEAN",
    "falso/verdadero": "BOOLEAN", "falso verdadero": "BOOLEAN",
    "cierto/falso": "BOOLEAN", "cierto falso": "BOOLEAN", "cierto o falso": "BOOLEAN",
    "v/f": "BOOLEAN", "vf": "BOOLEAN", "v f": "BOOLEAN", "f/v": "BOOLEAN",
    "v o f": "BOOLEAN", "si/no": "BOOLEAN", "si no": "BOOLEAN",
    # Opción múltiple (varias respuestas correctas)
    "multiple_choice": "MULTIPLE_CHOICE", "multiple choice": "MULTIPLE_CHOICE",
    "multiple": "MULTIPLE_CHOICE", "multi": "MULTIPLE_CHOICE", "mc": "MULTIPLE_CHOICE",
    "opcion multiple": "MULTIPLE_CHOICE", "opciones multiples": "MULTIPLE_CHOICE",
    "seleccion multiple": "MULTIPLE_CHOICE", "eleccion multiple": "MULTIPLE_CHOICE",
    "varias": "MULTIPLE_CHOICE", "varias respuestas": "MULTIPLE_CHOICE",
    "multiples respuestas": "MULTIPLE_CHOICE", "respuestas multiples": "MULTIPLE_CHOICE",
    "checkbox": "MULTIPLE_CHOICE", "casillas": "MULTIPLE_CHOICE",
    # Opción única / simple / normal (una sola respuesta) → mismo tipo del modelo
    "opcion unica": "MULTIPLE_CHOICE", "unica": "MULTIPLE_CHOICE",
    "seleccion unica": "MULTIPLE_CHOICE", "eleccion unica": "MULTIPLE_CHOICE",
    "respuesta unica": "MULTIPLE_CHOICE", "una respuesta": "MULTIPLE_CHOICE",
    "una sola respuesta": "MULTIPLE_CHOICE",
    "simple": "MULTIPLE_CHOICE", "opcion simple": "MULTIPLE_CHOICE",
    "seleccion simple": "MULTIPLE_CHOICE", "eleccion simple": "MULTIPLE_CHOICE",
    "respuesta simple": "MULTIPLE_CHOICE", "sencilla": "MULTIPLE_CHOICE",
    "opcion sencilla": "MULTIPLE_CHOICE", "radio": "MULTIPLE_CHOICE",
    "normal": "MULTIPLE_CHOICE", "opcion normal": "MULTIPLE_CHOICE",
    "single": "MULTIPLE_CHOICE", "single choice": "MULTIPLE_CHOICE",
    # Respuesta corta / abierta
    "short_answer": "SHORT_ANSWER", "short answer": "SHORT_ANSWER",
    "short": "SHORT_ANSWER", "respuesta corta": "SHORT_ANSWER",
    "respuesta abierta": "SHORT_ANSWER", "abierta": "SHORT_ANSWER",
    "texto libre": "SHORT_ANSWER", "open": "SHORT_ANSWER",
}
# Versión sin acentos para matching insensible a tildes.
_SYNONYMS_NOACCENT: dict[str, str] = {
    _strip_accents(k): v for k, v in _QUESTION_TYPE_SYNONYMS.items()
}


def normalize_question_type(raw: str) -> str:
    """Normaliza el tipo de pregunta aceptando español/lenguaje natural,
    insensible a acentos.

    Vacío → MULTIPLE_CHOICE. Si no se reconoce, devuelve el texto en mayúsculas
    para que la validación reporte 'Tipo inválido' con el valor original.
    """
    key = " ".join(str(raw or "").strip().lower().split())
    if not key:
        return "MULTIPLE_CHOICE"
    match = _SYNONYMS_NOACCENT.get(_strip_accents(key))
    if match:
        return match
    return key.upper().replace(" ", "_").replace("/", "_")


# Respuestas que indican Verdadero/Falso (comparadas sin acentos).
_BOOLEAN_ANSWERS: frozenset[str] = frozenset(
    {"true", "false", "verdadero", "falso", "1", "0", "si", "no", "cierto", "v", "f"}
)
# Valores que cuentan como "verdadero" al construir la metadata booleana.
_BOOLEAN_TRUE: frozenset[str] = frozenset({"true", "verdadero", "1", "si", "cierto", "v"})
# Si las opciones son literalmente estas palabras, la pregunta es V/F.
_BOOLEAN_OPTION_WORDS: frozenset[str] = frozenset(
    {"verdadero", "falso", "true", "false", "v", "f", "si", "no", "cierto"}
)


def _is_boolean_answer(value: str) -> bool:
    return _strip_accents((value or "").strip().lower()) in _BOOLEAN_ANSWERS


def infer_question_type(row: dict) -> str:
    """Deduce el tipo cuando el archivo NO trae columna 'Tipo'.

    - Opciones que son solo Verdadero/Falso  → BOOLEAN (V/F escrita como opciones).
    - Otras opciones A–E presentes           → MULTIPLE_CHOICE (única o múltiple
      según el nº de respuestas correctas: 'B' = única; 'A,C' = múltiple).
    - Sin opciones y respuesta V/F           → BOOLEAN.
    - Sin opciones y texto libre             → SHORT_ANSWER.
    """
    nonempty = [
        (row.get(f"option_{k}", "") or "").strip()
        for k in ("a", "b", "c", "d", "e")
    ]
    nonempty = [o for o in nonempty if o]
    if nonempty:
        if {_strip_accents(o.lower()) for o in nonempty} <= _BOOLEAN_OPTION_WORDS:
            return "BOOLEAN"
        return "MULTIPLE_CHOICE"
    if _is_boolean_answer(row.get("correct_answer", "")):
        return "BOOLEAN"
    return "SHORT_ANSWER"


def resolve_question_type(row: dict) -> str:
    """Usa la columna 'Tipo' si está presente; si no, infiere de la fila."""
    raw = (row.get("type", "") or "").strip()
    return normalize_question_type(raw) if raw else infer_question_type(row)

MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024   # 10 MB
MAX_ROWS: int = 2_000
SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({".csv", ".xlsx"})

# Opciones válidas para MULTIPLE_CHOICE
VALID_OPTION_KEYS: frozenset[str] = frozenset({"A", "B", "C", "D", "E"})


# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RowError:
    """Error en una fila específica del archivo de importación."""

    row: int
    column: str
    message: str

    def to_dict(self) -> dict:
        return {"row": self.row, "column": self.column, "message": self.message}


@dataclass
class ImportResult:
    """Resultado completo de un proceso de importación o validación."""

    success: bool
    questions_created: int
    total_rows: int
    errors: list[RowError] = field(default_factory=list)
    is_dry_run: bool = False
    preview_rows: list[dict] = field(default_factory=list)
    question_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "questions_created": self.questions_created,
            "total_rows": self.total_rows,
            "error_count": len(self.errors),
            "errors": [e.to_dict() for e in self.errors],
            "is_dry_run": self.is_dry_run,
            "preview_rows": self.preview_rows,
            "question_ids": self.question_ids,
        }


# ---------------------------------------------------------------------------
# Servicio principal
# ---------------------------------------------------------------------------

class ImportService:
    """
    Servicio de importación masiva de preguntas.

    Uso básico:
        service = ImportService()

        # Validar sin guardar
        result = service.dry_run(file_obj)

        # Importar (falla completamente si hay errores)
        with open("preguntas.csv", "rb") as f:
            result = service.process_file(f, organization, created_by)

    Uso con ImportJob (para tareas Celery):
        job = service.process_from_job(job_id)
    """

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------

    def validate_file(self, file: IO[bytes]) -> list[RowError]:
        """
        Valida el archivo sin persistir nada en la base de datos.

        Args:
            file: File-like object en modo binario.

        Returns:
            Lista de RowError. Lista vacía significa archivo válido.

        Raises:
            ImportFileFormatError: Si el formato del archivo es inválido.
            ImportFileTooLargeError: Si el archivo supera MAX_FILE_SIZE_BYTES.
        """
        self._check_file_size(file)
        rows = list(self._parse_file(file))
        errors: list[RowError] = []

        if not rows:
            return [RowError(row=1, column="—", message="El archivo no contiene datos.")]

        if len(rows) > MAX_ROWS:
            return [
                RowError(
                    row=0,
                    column="—",
                    message=f"El archivo supera el máximo de {MAX_ROWS} filas ({len(rows)} encontradas).",
                )
            ]

        for row_num, row_data in enumerate(rows, start=2):  # start=2: fila 1 = headers
            errors.extend(self._validate_row(row_num, row_data))

        return errors

    def dry_run(self, file: IO[bytes]) -> ImportResult:
        """
        Ejecuta validación completa sin persistir en la base de datos.

        Equivalente a validate_file() pero retorna un ImportResult
        estructurado que incluye el total de filas detectadas.

        Args:
            file: File-like object en modo binario.

        Returns:
            ImportResult con is_dry_run=True.
        """
        self._check_file_size(file)
        rows = list(self._parse_file(file))
        errors = self.validate_file(self._rewind(file))

        _PREVIEW_COLS = ("text", "option_a", "option_b", "option_c", "option_d", "option_e", "correct_answer", "category")
        preview_rows = [
            {k: v for k, v in row.items() if k in _PREVIEW_COLS}
            for row in rows[:10]
        ]

        return ImportResult(
            success=len(errors) == 0,
            questions_created=0,
            total_rows=len(rows),
            errors=errors,
            is_dry_run=True,
            preview_rows=preview_rows,
        )

    def full_preview(self, file: IO[bytes]) -> ImportResult:
        """
        Like dry_run() but returns ALL rows with UUIDs (not just 10).
        Used by the new synchronous preview endpoint.
        """
        self._check_file_size(file)
        rows = list(self._parse_file(file))

        if not rows:
            return ImportResult(
                success=False,
                questions_created=0,
                total_rows=0,
                errors=[RowError(row=1, column="—", message="El archivo no contiene datos.")],
                is_dry_run=True,
            )

        if len(rows) > MAX_ROWS:
            return ImportResult(
                success=False,
                questions_created=0,
                total_rows=len(rows),
                errors=[RowError(row=0, column="—", message=f"El archivo supera el máximo de {MAX_ROWS} filas ({len(rows)} encontradas).")],
                is_dry_run=True,
            )

        errors: list[RowError] = []
        for row_num, row_data in enumerate(rows, start=2):
            errors.extend(self._validate_row(row_num, row_data))

        preview_rows = []
        for row in rows:
            question_type = resolve_question_type(row)
            preview_rows.append({
                "_id": str(uuid.uuid4()),
                "text": row.get("text", ""),
                "question_type": question_type,
                "option_a": row.get("option_a", ""),
                "option_b": row.get("option_b", ""),
                "option_c": row.get("option_c", ""),
                "option_d": row.get("option_d", ""),
                "option_e": row.get("option_e", ""),
                "correct_answer": row.get("correct_answer", ""),
                "category": row.get("category", ""),
                "explanation": row.get("explanation", ""),
            })

        return ImportResult(
            success=len(errors) == 0,
            questions_created=0,
            total_rows=len(rows),
            errors=errors,
            is_dry_run=True,
            preview_rows=preview_rows,
        )

    def validate_rows_payload(self, rows: list[dict]) -> list[dict]:
        """
        Validate a list of DraftQuestion dicts from the frontend.
        Returns list of {row_id, field, message} for invalid rows.
        """
        errors = []
        for row in rows:
            row_id = row.get("_id", "unknown")
            text = row.get("text", "").strip()
            question_type = normalize_question_type(row.get("question_type", ""))

            if not text:
                errors.append({"row_id": row_id, "field": "text", "message": "El enunciado no puede estar vacío."})
            elif len(text) > 1000:
                errors.append({"row_id": row_id, "field": "text", "message": f"El enunciado supera 1,000 caracteres ({len(text)})."})

            if question_type not in VALID_QUESTION_TYPES:
                errors.append({"row_id": row_id, "field": "question_type", "message": f"Tipo inválido: {question_type}"})
                continue

            if question_type == "MULTIPLE_CHOICE":
                options_present = [
                    k for k in ("option_a", "option_b", "option_c", "option_d", "option_e")
                    if row.get(k, "").strip()
                ]
                if len(options_present) < 2:
                    errors.append({"row_id": row_id, "field": "options", "message": "Se necesitan al menos 2 opciones."})

                correct = row.get("correct_answer", "").strip()
                if not correct:
                    errors.append({"row_id": row_id, "field": "correct_answer", "message": "Selecciona al menos 1 respuesta correcta."})
                else:
                    correct_keys = self._parse_correct_answer_keys(correct)
                    defined_keys = {
                        k.upper() for k in ("A", "B", "C", "D", "E")
                        if row.get(f"option_{k.lower()}", "").strip()
                    }
                    invalid = correct_keys - defined_keys
                    if invalid:
                        errors.append({"row_id": row_id, "field": "correct_answer", "message": f"La respuesta '{','.join(sorted(invalid))}' no tiene opción definida."})

            elif question_type == "BOOLEAN":
                if not _is_boolean_answer(row.get("correct_answer", "")):
                    errors.append({"row_id": row_id, "field": "correct_answer", "message": "Para Verdadero/Falso, la respuesta debe ser 'Verdadero'/'Falso' (o true/false, sí/no, 1/0)."})

            elif question_type == "SHORT_ANSWER":
                if not row.get("correct_answer", "").strip():
                    errors.append({"row_id": row_id, "field": "correct_answer", "message": "Para SHORT_ANSWER, correct_answer es requerido."})

        return errors

    def persist_rows(self, rows: list[dict], organization, created_by) -> ImportResult:
        """
        Persist a list of validated DraftQuestion dicts (from frontend payload).
        Returns ImportResult with question_ids.
        """
        normalized = []
        for row in rows:
            normalized.append({
                "text": row.get("text", "").strip(),
                "type": normalize_question_type(row.get("question_type", "")),
                "option_a": row.get("option_a", ""),
                "option_b": row.get("option_b", ""),
                "option_c": row.get("option_c", ""),
                "option_d": row.get("option_d", ""),
                "option_e": row.get("option_e", ""),
                "correct_answer": row.get("correct_answer", ""),
                "category": row.get("category", ""),
                "explanation": row.get("explanation", ""),
            })

        question_ids = self._persist_questions(normalized, organization, created_by)

        return ImportResult(
            success=True,
            questions_created=len(question_ids),
            total_rows=len(rows),
            errors=[],
            is_dry_run=False,
            question_ids=question_ids,
        )

    def process_file(
        self,
        file: IO[bytes],
        organization: Organization,
        created_by: User,
        skip_invalid: bool = False,
    ) -> ImportResult:
        """
        Valida y persiste las preguntas del archivo en una transacción atómica.

        Política de errores:
            skip_invalid=False (default): si CUALQUIER fila falla, se aborta TODO.
            skip_invalid=True: importa las filas válidas y reporta las inválidas
            (ImportResult.errors); solo aborta si NINGUNA fila es válida.

        Args:
            file: File-like object en modo binario.
            organization: Tenant propietario de las preguntas a crear.
            created_by: Usuario que lanza la importación.

        Returns:
            ImportResult con questions_created > 0 si todo fue exitoso.

        Raises:
            ImportValidationError: Si hay errores de validación en filas.
            ImportFileFormatError: Si el formato del archivo es inválido.
        """
        self._check_file_size(file)
        rows = list(self._parse_file(file))
        total_rows = len(rows)

        logger.info(
            "Iniciando importación",
            extra={
                "organization_id": str(organization.id),
                "created_by_id": str(created_by.id),
                "total_rows": total_rows,
            },
        )

        # Validación previa (sin tocar la BD)
        errors = self.validate_file(self._rewind(file))
        if errors and not skip_invalid:
            logger.warning(
                "Importación abortada por errores de validación",
                extra={
                    "organization_id": str(organization.id),
                    "error_count": len(errors),
                    "first_error": errors[0].to_dict() if errors else None,
                },
            )
            raise ImportValidationError(
                message=f"La importación contiene {len(errors)} error(es) de validación.",
                errors=[e.to_dict() for e in errors],
            )

        # Modo tolerante: omite solo las filas inválidas (el header es la fila 1).
        if skip_invalid and errors:
            bad_rows = {e.row for e in errors}
            valid_rows = [r for i, r in enumerate(rows, start=2) if i not in bad_rows]
        else:
            valid_rows = rows

        if not valid_rows:
            raise ImportValidationError(
                message="Ninguna fila válida para importar.",
                errors=[e.to_dict() for e in errors],
            )

        # Persistencia atómica (solo filas válidas)
        question_ids = self._persist_questions(valid_rows, organization, created_by)

        logger.info(
            "Importación completada exitosamente",
            extra={
                "organization_id": str(organization.id),
                "questions_created": len(question_ids),
            },
        )

        return ImportResult(
            success=True,
            questions_created=len(question_ids),
            total_rows=total_rows,
            errors=errors if skip_invalid else [],
            is_dry_run=False,
            question_ids=question_ids,
        )

    def process_from_job(self, job_id: str) -> ImportResult:
        """
        Ejecuta una importación asociada a un ImportJob existente.

        Actualiza el estado del job durante el proceso.
        Diseñado para ser llamado desde tareas Celery.

        Args:
            job_id: UUID del ImportJob a procesar.

        Returns:
            ImportResult con el resultado de la operación.
        """
        from apps.exams.models import ImportJob

        try:
            job = ImportJob.objects.select_related("organization", "created_by").get(
                id=job_id
            )
        except ImportJob.DoesNotExist:
            raise ImportValidationError(f"ImportJob {job_id} no encontrado.")

        job.status = ImportJob.Status.PROCESSING
        job.started_at = timezone.now()
        job.save(update_fields=["status", "started_at"])

        try:
            with open(job.file_path, "rb") as f:
                result = self.process_file(f, job.organization, job.created_by)

            job.status = ImportJob.Status.COMPLETED
            job.rows_created = result.questions_created
            job.total_rows = result.total_rows

        except ImportValidationError as exc:
            job.status = ImportJob.Status.FAILED
            job.errors = exc.errors
            job.save(update_fields=["status", "errors"])
            raise

        except Exception as exc:
            job.status = ImportJob.Status.FAILED
            job.errors = [{"row": 0, "column": "—", "message": str(exc)}]
            logger.exception(
                "Error inesperado en importación",
                extra={"job_id": str(job_id)},
            )
            job.save(update_fields=["status", "errors"])
            raise

        finally:
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "rows_created", "total_rows", "completed_at"])

        return result

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse_file(self, file: IO[bytes]) -> Iterator[dict[str, str]]:
        """
        Detecta el formato y parsea el archivo retornando filas como dicts.

        La detección se hace por los primeros bytes (magic bytes):
            XLSX: 0x50 0x4B (ZIP header — XLSX es un ZIP)
            CSV: cualquier otro caso

        Args:
            file: File-like object en modo binario (posición al inicio).

        Yields:
            dict con claves en minúscula correspondientes a las columnas.

        Raises:
            ImportFileFormatError: Si el formato no es soportado o el archivo
                                   está corrupto.
        """
        header = file.read(4)
        file.seek(0)

        if header[:2] == b"PK":
            yield from self._parse_xlsx(file)
        else:
            yield from self._parse_csv(file)

    def _parse_csv(self, file: IO[bytes]) -> Iterator[dict[str, str]]:
        """Parsea CSV detectando delimitador (',', ';' o tab) y encoding.

        - Encoding: UTF-8 (con BOM de Excel); si falla, Windows-1252/Latin-1.
        - Delimitador: autodetecta (Excel en español suele exportar con ';').
        """
        raw = file.read()
        if isinstance(raw, str):
            content = raw
        else:
            try:
                content = raw.decode("utf-8-sig")  # maneja BOM de Excel
            except UnicodeDecodeError:
                content = raw.decode("cp1252", errors="replace")

        first_line = content.split("\n", 1)[0]
        try:
            delimiter = csv.Sniffer().sniff(first_line, delimiters=",;\t").delimiter
        except csv.Error:
            counts = {d: first_line.count(d) for d in (",", ";", "\t")}
            delimiter = max(counts, key=counts.get) if any(counts.values()) else ","

        try:
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)

            if reader.fieldnames is None:
                raise ImportFileFormatError("El CSV no tiene encabezados válidos.")

            # Normalizar y traducir nombres de columnas (español, insensible a tildes)
            normalized_headers = [
                _normalize_header(h) for h in reader.fieldnames if h is not None
            ]
            missing = REQUIRED_COLUMNS - set(normalized_headers)
            if missing:
                raise ImportFileFormatError(
                    f"Columnas requeridas faltantes en CSV: {', '.join(sorted(missing))}"
                )

            for row in reader:
                yield {
                    _normalize_header(k): (v or "").strip()
                    for k, v in row.items() if k is not None
                }

        except csv.Error as exc:
            raise ImportFileFormatError(f"Error al parsear CSV: {exc}") from exc

    def _parse_xlsx(self, file: IO[bytes]) -> Iterator[dict[str, str]]:
        """Parsea un archivo XLSX usando openpyxl en modo read-only."""
        wb = None
        try:
            wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
            ws = wb.active

            rows_iter = ws.iter_rows(values_only=True)
            header_row = next(rows_iter, None)

            if header_row is None:
                raise ImportFileFormatError("El archivo XLSX está vacío.")

            headers = [
                _normalize_header(h) if h is not None else ""
                for h in header_row
            ]
            missing = REQUIRED_COLUMNS - set(headers)
            if missing:
                raise ImportFileFormatError(
                    f"Columnas requeridas faltantes en XLSX: {', '.join(sorted(missing))}"
                )

            for row_values in rows_iter:
                row_dict = {
                    headers[i]: str(v).strip() if v is not None else ""
                    for i, v in enumerate(row_values)
                    if i < len(headers)
                }
                # Omitir filas completamente vacías
                if not any(row_dict.values()):
                    continue
                yield row_dict

        except openpyxl.utils.exceptions.InvalidFileException as exc:
            raise ImportFileFormatError(
                f"El archivo XLSX está corrupto o no es válido: {exc}"
            ) from exc
        finally:
            # Close on every path — including an exception mid-iteration or the
            # consumer abandoning the generator early — so the file handle never leaks.
            if wb is not None:
                wb.close()

    # ------------------------------------------------------------------
    # Validación de filas
    # ------------------------------------------------------------------

    def _validate_row(self, row_num: int, row: dict[str, str]) -> list[RowError]:
        """
        Valida una fila individual contra todas las reglas de negocio.

        Args:
            row_num: Número de fila (1-based, contando header como fila 1).
            row: Diccionario con los datos de la fila.

        Returns:
            Lista de RowError para esta fila. Vacía si es válida.
        """
        errors: list[RowError] = []

        # 1. Campo 'text' requerido
        text = row.get("text", "").strip()
        if not text:
            errors.append(RowError(row=row_num, column="text", message="El enunciado no puede estar vacío."))

        # 2. Campo 'type' — si no se especifica, se asume MULTIPLE_CHOICE
        question_type = resolve_question_type(row)
        if question_type not in VALID_QUESTION_TYPES:
            errors.append(
                RowError(
                    row=row_num,
                    column="type",
                    message=(
                        f"Tipo inválido '{question_type}'. "
                        f"Válidos: {', '.join(sorted(VALID_QUESTION_TYPES))}"
                    ),
                )
            )

        # 3. Validaciones específicas por tipo
        if question_type == "MULTIPLE_CHOICE":
            errors.extend(self._validate_multiple_choice_row(row_num, row))
        elif question_type == "BOOLEAN":
            errors.extend(self._validate_boolean_row(row_num, row))
        elif question_type == "SHORT_ANSWER":
            errors.extend(self._validate_short_answer_row(row_num, row))

        return errors

    def _validate_multiple_choice_row(
        self, row_num: int, row: dict[str, str]
    ) -> list[RowError]:
        errors: list[RowError] = []

        # Verificar que al menos dos opciones estén presentes
        options_present = [
            key for key in ("option_a", "option_b", "option_c", "option_d", "option_e")
            if row.get(key, "").strip()
        ]
        if len(options_present) < 2:
            errors.append(
                RowError(
                    row=row_num,
                    column="option_a/b/c/d",
                    message="MULTIPLE_CHOICE requiere al menos 2 opciones (option_a, option_b, ...).",
                )
            )

        # correct_answer no vacío + que las letras correspondan a opciones definidas.
        # Acepta respuesta única (A) o múltiple (A y B, A, B y C). Letras válidas A–E.
        correct = row.get("correct_answer", "").strip()
        if not correct:
            errors.append(
                RowError(row=row_num, column="correct_answer", message="correct_answer es requerido.")
            )
        else:
            correct_keys = self._parse_correct_answer_keys(correct.upper())
            defined = {
                k for k in ("A", "B", "C", "D", "E")
                if row.get(f"option_{k.lower()}", "").strip()
            }
            invalid = correct_keys - defined
            if not correct_keys:
                errors.append(RowError(
                    row=row_num, column="correct_answer",
                    message=f"La respuesta '{correct}' no corresponde a ninguna opción A–E.",
                ))
            elif invalid:
                miss = sorted(invalid)[0]
                errors.append(RowError(
                    row=row_num, column="correct_answer",
                    message=(
                        f"La respuesta '{', '.join(sorted(invalid))}' no tiene una opción "
                        f"definida en esta pregunta (¿falta la columna 'Opción {miss}'?)."
                    ),
                ))

        return errors

    def _validate_boolean_row(self, row_num: int, row: dict[str, str]) -> list[RowError]:
        errors: list[RowError] = []
        correct = row.get("correct_answer", "").strip()
        if not _is_boolean_answer(correct):
            errors.append(
                RowError(
                    row=row_num,
                    column="correct_answer",
                    message=(
                        f"Para Verdadero/Falso, la respuesta debe ser 'Verdadero'/'Falso' "
                        f"(o true/false, sí/no, 1/0). Recibido: '{row.get('correct_answer', '')}'"
                    ),
                )
            )
        return errors

    def _validate_short_answer_row(self, row_num: int, row: dict[str, str]) -> list[RowError]:
        errors: list[RowError] = []
        correct = row.get("correct_answer", "").strip()
        if not correct:
            errors.append(
                RowError(
                    row=row_num,
                    column="correct_answer",
                    message="Para SHORT_ANSWER, correct_answer debe contener las palabras clave esperadas.",
                )
            )
        return errors

    # ------------------------------------------------------------------
    # Persistencia
    # ------------------------------------------------------------------

    def _parse_correct_answer_keys(self, correct_raw: str) -> frozenset[str]:
        """
        Parse correct_answer string into a set of valid option keys.

        Uses regex to find individual A-D letters that are surrounded by
        non-alpha delimiters, avoiding character-by-character extraction
        bugs that would pick up letters from words like 'and' or 'y'.
        """
        import re
        letters = {g.upper() for g in re.split(r"[^A-Ea-e]+", correct_raw) if g}
        return frozenset(l for l in letters if l in VALID_OPTION_KEYS)

    @transaction.atomic
    def _persist_questions(
        self,
        rows: list[dict[str, str]],
        organization: Organization,
        created_by: User,
    ) -> list[str]:
        """
        Crea todos los objetos Question en una única transacción.

        Usa bulk_create para minimizar el número de queries a la BD.
        Si cualquier error ocurre durante la creación, toda la transacción
        hace rollback automáticamente.

        Args:
            rows: Lista de dicts con datos ya validados.
            organization: Tenant propietario.
            created_by: Autor de las preguntas.

        Returns:
            Número de preguntas creadas.
        """
        questions_to_create = [
            self._build_question_object(row, organization, created_by)
            for row in rows
        ]

        for q in questions_to_create:
            if not q.id:
                q.id = uuid.uuid4()

        created = Question.objects.bulk_create(questions_to_create, batch_size=500)

        logger.info(
            "bulk_create completado",
            extra={
                "organization_id": str(organization.id),
                "count": len(created),
            },
        )

        return [str(q.id) for q in created]

    def _build_question_object(
        self,
        row: dict[str, str],
        organization: Organization,
        created_by: User,
    ) -> Question:
        """
        Construye un objeto Question (sin guardar) a partir de una fila.

        Args:
            row: Dict con datos de la fila ya validados.
            organization: Tenant propietario.
            created_by: Autor de las preguntas.

        Returns:
            Instancia de Question lista para bulk_create.
        """
        question_type = resolve_question_type(row)
        metadata = self._build_metadata(question_type, row)

        return Question(
            organization=organization,
            question_text=row["text"].strip(),
            question_type=question_type,
            metadata=metadata,
            version_number=1,
            is_active=True,
            parent_question=None,
            created_by=created_by,
        )

    def _build_metadata(self, question_type: str, row: dict[str, str]) -> dict:
        """
        Construye el JSONField metadata de la pregunta según su tipo.

        Args:
            question_type: Tipo de pregunta normalizado en mayúsculas.
            row: Dict con los datos de la fila.

        Returns:
            Diccionario con la estructura de metadata apropiada.
        """
        category = row.get("category", "").strip() or None
        explanation = row.get("explanation", "").strip() or None

        if question_type == "MULTIPLE_CHOICE":
            correct_raw = row.get("correct_answer", "").strip().upper()
            correct_keys = self._parse_correct_answer_keys(correct_raw)
            seen = set()
            options = []
            for key in ("A", "B", "C", "D", "E"):
                col = f"option_{key.lower()}"
                text = row.get(col, "").strip()
                if text:
                    if key in seen:
                        continue
                    seen.add(key)
                    options.append({
                        "key": key,
                        "text": text,
                        "is_correct": key in correct_keys,
                    })
            return {
                "options": options,
                "correct_key": correct_raw,
                "correct_keys": sorted(correct_keys),
                "category": category,
                "explanation": explanation,
            }

        if question_type == "BOOLEAN":
            raw = _strip_accents(row.get("correct_answer", "").strip().lower())
            correct_bool = raw in _BOOLEAN_TRUE
            return {"correct_answer": correct_bool, "category": category, "explanation": explanation}

        if question_type == "SHORT_ANSWER":
            raw_answer = row.get("correct_answer", "").strip()
            # Soporta múltiples palabras clave separadas por '|'
            keywords = [kw.strip() for kw in raw_answer.split("|") if kw.strip()]
            return {
                "keywords": keywords,
                "case_sensitive": False,
                "category": category,
                "explanation": explanation,
            }

        return {"category": category, "explanation": explanation}

    # ------------------------------------------------------------------
    # Utilidades
    # ------------------------------------------------------------------

    def _check_file_size(self, file: IO[bytes]) -> None:
        """
        Verifica que el archivo no supere MAX_FILE_SIZE_BYTES.

        Raises:
            ImportFileTooLargeError: Si el archivo es demasiado grande.
        """
        file.seek(0, 2)  # Seek al final
        size = file.tell()
        file.seek(0)

        if size > MAX_FILE_SIZE_BYTES:
            raise ImportFileTooLargeError(
                f"El archivo ({size / 1024 / 1024:.1f} MB) supera el máximo permitido "
                f"({MAX_FILE_SIZE_BYTES / 1024 / 1024:.0f} MB).",
                context={"file_size_bytes": size, "max_size_bytes": MAX_FILE_SIZE_BYTES},
            )

    @staticmethod
    def _rewind(file: IO[bytes]) -> IO[bytes]:
        """Regresa el cursor del file al inicio y lo retorna."""
        file.seek(0)
        return file
