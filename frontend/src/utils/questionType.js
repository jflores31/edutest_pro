/**
 * questionType.js — Fuente única de verdad para el tipo de pregunta.
 *
 * El backend solo almacena tres `question_type`: MULTIPLE_CHOICE, BOOLEAN y
 * SHORT_ANSWER. La distinción entre "opción única" y "opción múltiple" NO es un
 * tipo aparte: se deriva del nº de respuestas correctas en `metadata`
 * (1 clave → única, ≥2 → múltiple). Estas utilidades centralizan esa regla,
 * antes duplicada en QuestionBankPage, ExamEditorPage y QuestionRenderers.
 */

/** Enums tal cual los persiste el backend. */
export const BackendType = Object.freeze({
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  BOOLEAN: 'BOOLEAN',
  SHORT_ANSWER: 'SHORT_ANSWER',
});

/** Tipos "lógicos" que usa el frontend (MULTIPLE_CHOICE se desdobla en dos). */
export const LogicalType = Object.freeze({
  SINGLE_CHOICE: 'single_choice',
  MULTIPLE_CHOICE: 'multiple_choice',
  BOOLEAN: 'boolean',
  SHORT_ANSWER: 'short_answer',
});

const VALID_KEY = /^[A-E]$/;

/**
 * Extrae las claves de respuesta correcta (A–E) desde el `metadata` ya
 * normalizado por el backend. Acepta ambas formas: `correct_keys` (array) o
 * `correct_key` (cadena "A" | "A,C"). Devuelve un array de claves en mayúsculas.
 *
 * Nota: para entrada CSV cruda del usuario (con conectores tipo "A y C") usa el
 * parser específico del importador; aquí asumimos datos ya saneados.
 *
 * @param {object} [metadata]
 * @returns {string[]}
 */
export function parseCorrectKeys(metadata) {
  const meta = metadata || {};
  if (Array.isArray(meta.correct_keys) && meta.correct_keys.length) {
    return meta.correct_keys.map(k => String(k).toUpperCase()).filter(k => VALID_KEY.test(k));
  }
  if (typeof meta.correct_key === 'string') {
    return meta.correct_key.toUpperCase().split(/[^A-E]+/).filter(k => VALID_KEY.test(k));
  }
  return [];
}

/**
 * ¿Una pregunta MULTIPLE_CHOICE admite varias respuestas?
 * Prioriza la pista `multiple` (presente en el snapshot saneado del alumno) y,
 * si no está, cuenta las claves correctas (datos de docente/preview).
 *
 * @param {object} [metadata]
 * @returns {boolean}
 */
export function isMultiAnswer(metadata) {
  const meta = metadata || {};
  if (meta.multiple === true) return true;
  return parseCorrectKeys(meta).length > 1;
}

/**
 * Resuelve el tipo lógico de una pregunta a partir del `question_type` del
 * backend y su `metadata`. MULTIPLE_CHOICE se desdobla en single/multiple.
 *
 * @param {string} [backendType] - question_type devuelto por la API
 * @param {object} [metadata]
 * @returns {string} uno de LogicalType
 */
export function resolveLogicalType(backendType, metadata) {
  switch (backendType) {
    case BackendType.BOOLEAN:
      return LogicalType.BOOLEAN;
    case BackendType.SHORT_ANSWER:
      return LogicalType.SHORT_ANSWER;
    default: // MULTIPLE_CHOICE (o desconocido → se trata como opción)
      return isMultiAnswer(metadata) ? LogicalType.MULTIPLE_CHOICE : LogicalType.SINGLE_CHOICE;
  }
}

/**
 * Metadatos de presentación (etiqueta + variante de Badge) por tipo lógico.
 * Fuente única para los badges del banco de preguntas.
 */
export const QUESTION_TYPE_META = Object.freeze({
  [LogicalType.SINGLE_CHOICE]:   { label: 'Opción única',   variant: 'indigo' },
  [LogicalType.MULTIPLE_CHOICE]: { label: 'Opción múltiple', variant: 'violet' },
  [LogicalType.BOOLEAN]:         { label: 'V/F',             variant: 'amber'  },
  [LogicalType.SHORT_ANSWER]:    { label: 'Respuesta corta', variant: 'teal'   },
});
