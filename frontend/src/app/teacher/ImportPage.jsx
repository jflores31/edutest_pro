/**
 * ImportPage.jsx — Importar preguntas de exámenes y alumnos
 * Tab exámenes: título + archivo CSV/XLSX → POST /api/v1/exams/import/ (crea examen + preguntas en un paso)
 * Tab alumnos: CSV/XLSX → /api/v1/students/bulk/
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card, Tabs } from '../../design-system';
import { students as studentsApi, courses as coursesApi, imports as importsApi, exams as examsApi } from '../../services/api';
import UploadZone from '../../features/import/UploadZone';

const TABS = [
  { key: 'examenes', label: 'Importar preguntas', icon: <Icon name="book" size={14} /> },
  { key: 'alumnos', label: 'Importar alumnos', icon: <Icon name="users" size={14} /> },
];

// ── Shared helpers ──────────────────────────────────────────────────────────

function DropZone({ onFile, dragOver, setDragOver, inputRef }) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
        dragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-fg-3'
      }`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={e => onFile(e.target.files[0])}
      />
      <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/10 mx-auto mb-4">
        <Icon name="upload" size={22} className="text-accent" />
      </div>
      <h3 className="text-base font-medium text-fg-0 mb-1">Arrastra el archivo aquí</h3>
      <p className="text-sm text-fg-2 mb-4">o haz clic para seleccionar</p>
      <Badge variant="neutral">CSV · XLSX · Máx 10 MB</Badge>
    </div>
  );
}

function DownloadTemplate({ columns, filename, examples }) {
  function csvField(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function download() {
    const lines = [columns, ...examples].map(row => row.map(csvField).join(','));
    // BOM → Excel abre como UTF-8 (tildes/ñ correctas)
    const blob = new Blob(['\uFEFF' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="ghost" size="sm" icon={<Icon name="download" size={13} />} onClick={download}>
      Descargar plantilla
    </Button>
  );
}

// ── Import Exámenes ─────────────────────────────────────────────────────────

const EXAM_COLUMNS = [
  'Pregunta', 'Opción A', 'Opción B', 'Opción C', 'Opción D', 'Opción E',
  'Respuesta Correcta', 'Explicación', 'Tema',
];
// El tipo se infiere de la fila (no hay columna "Tipo"):
//  - opción única: opciones llenas + 1 letra correcta
//  - opción múltiple: opciones llenas + varias correctas (B,E)
//  - verdadero/falso: opciones vacías + Verdadero/Falso
// Hasta 5 opciones (A–E); deja vacías las que no uses.
const EXAM_EXAMPLES = [
  ['¿Cuál es la capa de transporte del modelo OSI?',
   'Capa de Red', 'Capa de Transporte', 'Capa de Sesión', 'Capa de Aplicación', 'Capa Física',
   'B', 'La capa de transporte gestiona TCP y UDP', 'Redes'],
  ['El modelo OSI tiene 7 capas',
   '', '', '', '', '',
   'Verdadero', 'El modelo OSI define 7 capas', 'Redes'],
  ['Marca los protocolos de la capa de transporte (elige 2)',
   'Ethernet', 'TCP', 'IP', 'HTTP', 'UDP',
   'B,E', 'TCP y UDP operan en la capa de transporte', 'Redes'],
];

// ── Format info card (shared) ────────────────────────────────────────────────

function FormatInfoCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card padding="md">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-fg-0">Formato del archivo</h4>
          <p className="text-xs text-fg-2 mt-0.5">El archivo debe tener estas columnas en la primera fila</p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadTemplate
            columns={EXAM_COLUMNS}
            filename="plantilla-preguntas.csv"
            examples={EXAM_EXAMPLES}
          />
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded text-fg-3 hover:text-fg-0 hover:bg-bg-2 transition-colors"
            aria-label={expanded ? 'Colapsar formato' : 'Expandir formato'}
          >
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <>
            <div className="bg-bg-2 rounded-xl px-4 py-3 mb-4 overflow-x-auto">
            <code className="text-xs font-mono text-accent whitespace-nowrap">
              {EXAM_COLUMNS.join(',')}
            </code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-fg-2">
            <p><span className="text-fg-0 font-medium">Pregunta</span> — Enunciado de la pregunta <span className="text-danger">*</span></p>
            <p><span className="text-fg-0 font-medium">Opción A … E</span> — Hasta 5 alternativas (deja vacías las que no uses; todas vacías en Verdadero/Falso)</p>
            <p><span className="text-fg-0 font-medium">Respuesta Correcta</span> — Letra(s) <span className="font-mono">A–E</span>, o <span className="font-mono">Verdadero</span>/<span className="font-mono">Falso</span> <span className="text-danger">*</span></p>
            <p><span className="text-fg-0 font-medium">Explicación</span> — Justificación de la respuesta (opcional)</p>
            <p><span className="text-fg-0 font-medium">Tema</span> — Categoría o tema de la pregunta (opcional)</p>
          </div>

          <div className="mt-3 p-3 bg-accent/5 border border-accent/20 rounded-xl">
            <p className="text-xs text-accent font-medium mb-0.5">El tipo se detecta solo</p>
            <ul className="text-xs text-fg-2 space-y-0.5 list-disc list-inside">
              <li><span className="text-fg-0 font-medium">Opción única</span>: opciones llenas + <span className="font-mono">1</span> letra correcta (<span className="font-mono">B</span>)</li>
              <li><span className="text-fg-0 font-medium">Opción múltiple</span>: opciones llenas + varias correctas (<span className="font-mono">A,C</span>)</li>
              <li><span className="text-fg-0 font-medium">Verdadero/Falso</span>: opciones vacías + <span className="font-mono">Verdadero</span> o <span className="font-mono">Falso</span></li>
            </ul>
          </div>

          <div className="mt-4 p-3 bg-bg-3 rounded-xl space-y-1.5">
            <p className="text-2xs text-fg-3 font-medium">Ejemplos (Pregunta, A, B, C, D, E, Respuesta, Explicación, Tema):</p>
            <code className="block text-2xs font-mono text-fg-1 break-all">"¿Capa de transporte?","Red","Transporte","Sesión","Aplicación","Física","B","…","Redes"</code>
            <code className="block text-2xs font-mono text-fg-1 break-all">"El modelo OSI tiene 7 capas","","","","","","Verdadero","…","Redes"</code>
            <code className="block text-2xs font-mono text-fg-1 break-all">"Protocolos de transporte (elige 2)","Ethernet","TCP","IP","HTTP","UDP","B,E","…","Redes"</code>
          </div>

          <div className="mt-3 p-3 bg-warn/5 border border-warn/20 rounded-xl">
            <p className="text-xs text-warn font-medium mb-0.5">Reglas de importación</p>
            <ul className="text-xs text-fg-2 space-y-0.5 list-disc list-inside">
              <li>Formatos: <span className="font-mono">.csv</span> (coma o punto y coma) y <span className="font-mono">.xlsx</span></li>
              <li>Puedes editar cualquier fila antes de confirmar</li>
              <li>Las preguntas con errores no resueltos serán omitidas</li>
              <li>Máximo 2 000 preguntas por archivo</li>
              <li>Codificación UTF-8 recomendada para caracteres especiales (tildes, ñ)</li>
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Import Success Screen ────────────────────────────────────────────────────

function ImportSuccessScreen({ examTitle, added = 0, duplicates = 0, skipped = 0, appended = false, onReset, onGoToEditor }) {
  return (
    <Card padding="lg">
      <div className="text-center py-8">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-ok/10 mx-auto mb-5">
          <Icon name="check" size={32} className="text-ok" />
        </div>
        <h3 className="text-2xl font-semibold text-fg-0 mb-2">{appended ? '¡Preguntas agregadas!' : '¡Examen creado!'}</h3>
        <p className="text-base text-fg-1 mb-1">
          <span className="font-bold text-fg-0">"{examTitle}"</span>
        </p>
        <p className="text-sm text-fg-2 mb-1">
          <span className="font-bold text-ok">{added}</span> pregunta(s) {appended ? 'agregada(s)' : 'importada(s)'} correctamente
        </p>
        {duplicates > 0 && (
          <p className="text-xs text-fg-3 mb-1">{duplicates} duplicada(s) omitida(s) (ya estaban en el examen).</p>
        )}
        {skipped > 0 && (
          <p className="text-xs text-warn mb-1">{skipped} pregunta(s) omitida(s) por errores (revisa el formato/respuestas).</p>
        )}
        <div className="mb-6" />
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button variant="ghost" onClick={onReset}>
            Importar otro archivo
          </Button>
          <Button onClick={onGoToEditor}>
            <Icon name="edit" size={14} />
            Ir al editor del examen →
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Selector de destino: crear examen nuevo (título) o agregar a uno existente (selector).
function ImportTargetPicker({ mode, setMode, examTitle, setExamTitle, exams, selectedExamId, setSelectedExamId, clearError }) {
  return (
    <div className="mb-6">
      <div className="inline-flex rounded-xl border border-line overflow-hidden mb-3">
        {[['new', 'Examen nuevo'], ['existing', 'Examen existente']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setMode(key); clearError(); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === key ? 'bg-accent text-bg-1' : 'text-fg-2 hover:text-fg-0 hover:bg-bg-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <div>
          <label className="block text-sm font-semibold text-fg-0 mb-2">
            Título del examen <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={examTitle}
            onChange={e => { setExamTitle(e.target.value); clearError(); }}
            placeholder="Ej: Examen de Matemáticas - Unidad 3"
            className="w-full bg-transparent border-2 border-line rounded-xl px-4 py-3 text-fg-0 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          />
          <p className="text-xs text-fg-3 mt-1">Mínimo 3 caracteres. Este será el nombre visible del examen.</p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-semibold text-fg-0 mb-2">
            Examen destino <span className="text-danger">*</span>
          </label>
          <select
            value={selectedExamId}
            onChange={e => { setSelectedExamId(e.target.value); clearError(); }}
            className="w-full bg-transparent border-2 border-line rounded-xl px-4 py-3 text-fg-0 text-sm outline-none focus:border-accent transition-colors"
          >
            <option value="">Selecciona un examen…</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
          <p className="text-xs text-fg-3 mt-1">
            Las preguntas se añaden al examen; las que ya existan (mismo enunciado) se omiten.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Import Wizard (combined endpoint) ────────────────────────────────────────

const WIZARD_STEPS = [
  { key: 'upload', label: 'Archivo' },
  { key: 'preview', label: 'Previsualizar' },
  { key: 'create', label: 'Crear' },
];

function WizardSteps({ phase }) {
  const stepIndex = {
    idle: 0, uploading: 0, preview: 1, creating: 2, done: 2,
    error: -1, parsing_error: -1,
  };
  const current = stepIndex[phase] ?? 0;
  if (current < 0) return null;

  return (
    <div className="flex items-center gap-2 mb-6">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors
            ${i === current ? 'bg-accent/10 text-accent' : i < current ? 'text-ok' : 'text-fg-3'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
              ${i === current ? 'bg-accent text-bg-1' : i < current ? 'bg-ok text-white' : 'bg-bg-2 text-fg-3'}`}>
              {i < current ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-ok' : 'bg-line'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ImportExamsTab() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle');
  const [examTitle, setExamTitle] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [mode, setMode] = useState('new');          // 'new' | 'existing'
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // Carga los exámenes disponibles la primera vez que se elige "Examen existente".
  useEffect(() => {
    if (mode !== 'existing' || exams.length) return;
    examsApi.list({ include_archived: false })
      .then(d => setExams(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {});
  }, [mode, exams.length]);

  function reset() {
    setPhase('idle');
    setPreviewData(null);
    setErrorMsg('');
    setSuccessInfo(null);
    setExamTitle('');
    fileRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  }

  // Step 1 → Upload file for preview (full_preview endpoint: all rows, full detail)
  async function handleFile(file) {
    if (!file) return;
    // El título no es necesario para previsualizar; se valida al crear el examen.
    fileRef.current = file;
    setPhase('uploading');
    setErrorMsg('');

    const form = new FormData();
    form.append('file', file);

    try {
      const data = await importsApi.preview(form);
      setPreviewData(data);
      setPhase('preview');
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
    }
  }

  // Step 2 → Create exam + questions (combined endpoint)
  async function handleCreate() {
    if (!fileRef.current) return;
    if (mode === 'new') {
      if (!examTitle.trim() || examTitle.trim().length < 3) {
        setErrorMsg('El título del examen debe tener al menos 3 caracteres.');
        return;
      }
    } else if (!selectedExamId) {
      setErrorMsg('Selecciona el examen al que agregar las preguntas.');
      return;
    }
    setPhase('creating');
    setErrorMsg('');

    const form = new FormData();
    form.append('file', fileRef.current);
    if (mode === 'new') form.append('title', examTitle.trim());
    else form.append('exam_id', selectedExamId);

    try {
      const data = await examsApi.importExam(form);
      setSuccessInfo({
        examTitle: data.exam_title,
        added: data.added ?? data.questions_created ?? 0,
        duplicates: data.duplicates ?? 0,
        skipped: data.error_count ?? Math.max(0, (data.total_rows || 0) - (data.questions_created || 0)),
        appended: !!data.appended,
        examId: data.exam_id,
      });
      setPhase('done');
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
    }
  }

  // ── Creating (loading state) ──
  if (phase === 'creating') {
    return (
      <div className="text-center py-12">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-fg-0 mb-1">{mode === 'existing' ? 'Agregando preguntas' : 'Creando examen'}</h3>
        <p className="text-sm text-fg-2">
          {mode === 'existing' ? 'Importando preguntas al examen seleccionado…' : `Importando preguntas y creando "${examTitle}"…`}
        </p>
      </div>
    );
  }
  if (phase === 'done' && successInfo) {
    return (
      <>
        <WizardSteps phase="done" />
        <ImportSuccessScreen
          examTitle={successInfo.examTitle}
          added={successInfo.added}
          duplicates={successInfo.duplicates}
          skipped={successInfo.skipped}
          appended={successInfo.appended}
          examId={successInfo.examId}
          onReset={reset}
          onGoToEditor={() => navigate(`/teacher/exams/${successInfo.examId}/edit`)}
        />
      </>
    );
  }

  // ── Error ──
  if (phase === 'error') {
    return (
      <Card padding="lg">
        <div className="text-center py-6">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-danger/10 mx-auto mb-3">
            <Icon name="info" size={22} className="text-danger" />
          </div>
          <h3 className="text-lg font-semibold text-fg-0 mb-1">Error en la importación</h3>
          <p className="text-sm text-fg-2 mb-4">{errorMsg}</p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => { setPhase('idle'); setErrorMsg(''); }}>
              Corregir y reintentar
            </Button>
            <Button variant="ghost" onClick={reset}>
              Empezar de nuevo
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── Preview ──
  if (phase === 'preview' && previewData) {
    const rows = previewData.rows || [];
    const total = previewData.total_rows || rows.length;

    // El backend numera las filas con start=2 (fila 1 = cabecera): la fila de
    // datos en el índice i corresponde a e.row === i + 2. Agrupamos por índice.
    const errorsByIndex = {};
    (previewData.errors || []).forEach(e => {
      const idx = (e.row ?? 0) - 2;
      if (idx < 0) { (errorsByIndex[-1] = errorsByIndex[-1] || []).push(e.message); return; }
      (errorsByIndex[idx] = errorsByIndex[idx] || []).push(e.message);
    });
    const rowsWithErrors = Object.keys(errorsByIndex).filter(k => Number(k) >= 0).length;
    const validCount = Math.max(0, total - rowsWithErrors);
    const errorCount = rowsWithErrors;

    // El modelo solo tiene MULTIPLE_CHOICE/BOOLEAN/SHORT_ANSWER: única vs múltiple
    // se distingue por el nº de respuestas correctas (1 letra = única → radio;
    // varias = múltiple → checkbox). La etiqueta del preview lo refleja.
    const correctKeyCount = (raw) => {
      const conn = new Set(['y', 'o', 'u', 'and', 'or', '&', '+']); // 'e' NO (choca con E)
      const keys = new Set();
      String(raw || '').split(/[,;/]|\s+/).map(t => t.trim()).filter(Boolean)
        .forEach(t => { if (!conn.has(t.toLowerCase()) && /^[a-eA-E]$/.test(t)) keys.add(t.toUpperCase()); });
      return keys.size;
    };
    const typeLabel = (r) => {
      if (r.question_type === 'BOOLEAN') return 'Verdadero/Falso';
      if (r.question_type === 'SHORT_ANSWER') return 'Respuesta corta';
      if (r.question_type === 'MULTIPLE_CHOICE')
        return correctKeyCount(r.correct_answer) > 1 ? 'Opción múltiple' : 'Opción única';
      return r.question_type || '—';
    };

    // Exporta SOLO las filas con error + una columna "Error" (formato de 9 columnas).
    const exportErrors = () => {
      const head = ['Pregunta', 'Opción A', 'Opción B', 'Opción C', 'Opción D', 'Opción E', 'Respuesta Correcta', 'Explicación', 'Tema', 'Error'];
      const cell = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const lines = [head.map(cell).join(',')];
      rows.forEach((r, i) => {
        const errs = errorsByIndex[i];
        if (!errs || !errs.length) return;
        lines.push([r.text, r.option_a, r.option_b, r.option_c, r.option_d, r.option_e, r.correct_answer, r.explanation, r.category, errs.join(' | ')].map(cell).join(','));
      });
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'errores_importacion.csv'; a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <>
        <WizardSteps phase="preview" />
        <div className="space-y-4">
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-semibold text-fg-0">Previsualización</h4>
                <p className="text-xs text-fg-2 mt-0.5">
                  {total} pregunta{total !== 1 ? 's' : ''} detectada{total !== 1 ? 's' : ''}
                  {errorCount > 0 && (
                    <span className="text-warn ml-1">({errorCount} con errores)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <Button variant="ghost" size="sm" icon={<Icon name="download" size={13} />} onClick={exportErrors}>
                    Exportar errores
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setPhase('idle'); setPreviewData(null); }}>
                  Volver
                </Button>
                <Button
                  onClick={handleCreate}
                  icon={<Icon name="check" size={14} />}
                >
                  {mode === 'existing' ? 'Agregar preguntas' : 'Crear examen'}
                </Button>
              </div>
            </div>

            {/* Panel de validación */}
            <div className={`mb-4 rounded-xl border p-3 ${errorCount === 0 ? 'bg-ok/10 border-ok/30' : 'bg-danger/10 border-danger/30'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-fg-0">
                <span>{errorCount === 0 ? '✅' : '❌'}</span>
                {errorCount === 0
                  ? 'Todas las filas son válidas'
                  : `${rowsWithErrors} fila(s) con errores — se omitirán al importar`}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-fg-2">
                <span><b className="text-fg-0">{total}</b> detectadas</span>
                <span><b className="text-ok">{validCount}</b> válidas</span>
                <span><b className="text-danger">{rowsWithErrors}</b> con errores</span>
              </div>
              {rowsWithErrors > 0 && (
                <ul className="mt-2 max-h-32 overflow-auto text-xs text-fg-2 space-y-0.5 border-t border-line/60 pt-2">
                  {Object.entries(errorsByIndex)
                    .filter(([k]) => Number(k) >= 0)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .slice(0, 100)
                    .map(([idx, msgs]) => (
                      <li key={idx}><span className="font-mono text-fg-3">Pregunta {Number(idx) + 1}:</span> {msgs.join('; ')}</li>
                    ))}
                </ul>
              )}
            </div>

            {errorMsg && (
              <div className="mb-3 p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl">{errorMsg}</div>
            )}
            <ImportTargetPicker
              mode={mode} setMode={setMode}
              examTitle={examTitle} setExamTitle={setExamTitle}
              exams={exams} selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId}
              clearError={() => setErrorMsg('')}
            />

            {/* Preview table */}
            <div className="max-h-96 overflow-auto border border-line rounded-xl">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-bg-2 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-fg-3 font-semibold w-8">#</th>
                    <th className="text-left px-3 py-2 text-fg-3 font-semibold">Pregunta</th>
                    <th className="text-left px-3 py-2 text-fg-3 font-semibold w-32 whitespace-nowrap">Tipo</th>
                    <th className="text-left px-3 py-2 text-fg-3 font-semibold w-20">Tema</th>
                    <th className="text-left px-3 py-2 text-fg-3 font-semibold w-16">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rowErrs = errorsByIndex[i] || [];
                    const hasError = rowErrs.length > 0;
                    const errMsg = rowErrs.join(' · ');
                    return (
                      <tr key={r._id || i} className={`border-t border-line/40 ${hasError ? 'bg-danger/5' : ''}`}>
                        <td className="px-3 py-2 text-fg-3 font-mono">{i + 1}</td>
                        <td className="px-3 py-2 text-fg-1 max-w-xs truncate" title={r.text || ''}>
                          {r.text || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-fg-3 whitespace-nowrap">{typeLabel(r)}</span>
                        </td>
                        <td className="px-3 py-2 text-fg-2 max-w-[120px] truncate">
                          {r.category || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {hasError
                            ? <Badge variant="danger" title={errMsg}>Error</Badge>
                            : <Badge variant="success">Válida</Badge>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <FormatInfoCard />
        </div>
      </>
    );
  }

  // ── Idle / Uploading ──
  return (
    <>
      <WizardSteps phase={phase} />
      <div className="space-y-4">
        <Card padding="lg">
          {/* Destino: examen nuevo o existente */}
          <ImportTargetPicker
            mode={mode} setMode={setMode}
            examTitle={examTitle} setExamTitle={setExamTitle}
            exams={exams} selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId}
            clearError={() => setErrorMsg('')}
          />

          {/* Upload zone */}
          <UploadZone
            onFile={handleFile}
            dragOver={dragOver}
            setDragOver={setDragOver}
            inputRef={inputRef}
            error={errorMsg || null}
          />
          {phase === 'uploading' && (
            <div className="mt-6 text-center">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-fg-2">Analizando archivo…</p>
            </div>
          )}
        </Card>

        <FormatInfoCard />
      </div>
    </>
  );
}

// ── Import Alumnos ──────────────────────────────────────────────────────────

const STUDENT_COLUMNS = ['"DNI"', '"Nombres"', '"Apellidos"', '"Correo"'];
const STUDENT_EXAMPLE = ['"12345678"', '"Jesús"', '"Flores"', '"jesus@ejemplo.com"'];

// RFC 4180 compliant CSV line parser — handles quoted fields with embedded delimiters/newlines
function parseCsvLine(line, delim = ',') {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) { fields.push(''); break; }
    if (line[i] === '"') {
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      fields.push(field.trim());
      if (line[i] === delim) i++;
    } else {
      const end = line.indexOf(delim, i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

function parseCsvRows(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  // Detecta el delimitador (Excel en español exporta con ';')
  const delim = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
  const header = parseCsvLine(lines[0], delim).map(h => h.toLowerCase());

  const colMap = {
    dni: ['dni', 'code', 'codigo', 'código'],
    first_name: ['nombres', 'nombre', 'first_name', 'firstname'],
    last_name: ['apellidos', 'apellido', 'last_name', 'lastname'],
    email: ['correo', 'email', 'mail'],
  };

  function findCol(keys) {
    for (const k of keys) {
      const i = header.indexOf(k);
      if (i !== -1) return i;
    }
    return -1;
  }

  const idx = {
    dni: findCol(colMap.dni),
    first_name: findCol(colMap.first_name),
    last_name: findCol(colMap.last_name),
    email: findCol(colMap.email),
  };

  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line, delim);
    return {
      code: idx.dni >= 0 ? cols[idx.dni] ?? '' : '',
      first_name: idx.first_name >= 0 ? cols[idx.first_name] ?? '' : '',
      last_name: idx.last_name >= 0 ? cols[idx.last_name] ?? '' : '',
      email: idx.email >= 0 ? cols[idx.email] ?? '' : '',
    };
  }).filter(r => r.code && r.first_name && r.last_name);
}

function ImportStudentsTab() {
  const navigate = useNavigate();
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    coursesApi.list().then(data => {
      if (!alive) return;
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setCourses(list);
      if (list.length === 1) setCourseId(String(list[0].id));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    // XLSX (u otros): no se puede previsualizar en el navegador; el backend lo
    // parsea de forma robusta al importar (CSV con coma/;/tab, o XLSX).
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setRows([]);
      setStep('preview');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setRows(parseCsvRows(e.target.result));
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setRows([]);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleImport() {
    if (!courseId) { setError('Selecciona un curso antes de importar.'); return; }
    setImporting(true);
    setError('');
    try {
      // Sube el archivo original al backend, que parsea CSV (coma/;/tab) y XLSX.
      const data = await studentsApi.importFile(courseId, file);
      setResult(data);
      setStep('done');
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  if (step === 'done') {
    return (
      <Card padding="lg">
        <div className="text-center py-8">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-ok/10 mx-auto mb-4">
            <Icon name="check" size={24} className="text-ok" />
          </div>
          <h3 className="text-xl font-semibold text-fg-0 mb-1">Importación completada</h3>
          <p className="text-sm text-fg-2 mb-1">
            {result?.created ?? 0} alumnos creados correctamente
          </p>
          {result?.skipped?.length > 0 && (
            <p className="text-xs text-warn mb-1">{result.skipped.length} omitidos (DNI ya registrado)</p>
          )}
          {result?.errors?.length > 0 && (
            <p className="text-xs text-danger mb-1">{result.errors.length} filas con datos incompletos</p>
          )}
          <div className="mb-6" />
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={reset}>Importar otro archivo</Button>
            <Button onClick={() => navigate('/teacher/students')}>Ver alumnos</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-fg-0">{file?.name}</h4>
              <p className="text-xs text-fg-2 mt-0.5">
                {rows.length > 0
                  ? `${rows.length} alumnos detectados`
                  : 'Vista previa no disponible para este formato; se validará al importar'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
          </div>

          {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl">{error}</div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-fg-1 font-medium mb-1">Curso de destino <span className="text-danger">*</span></label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2.5 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
            >
              <option value="">Seleccionar curso…</option>
              {courses.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>

            {rows.length > 0 && (
            <div className="max-h-48 overflow-auto border border-line rounded-xl mb-4">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="bg-bg-2 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-fg-3 font-semibold">DNI</th>
                  <th className="text-left px-3 py-2 text-fg-3 font-semibold">Nombres</th>
                  <th className="text-left px-3 py-2 text-fg-3 font-semibold">Apellidos</th>
                  <th className="text-left px-3 py-2 text-fg-3 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-line/40">
                    <td className="px-3 py-1.5 font-mono text-fg-1">{r.code}</td>
                    <td className="px-3 py-1.5 text-fg-1">{r.first_name}</td>
                    <td className="px-3 py-1.5 text-fg-1">{r.last_name}</td>
                    <td className="px-3 py-1.5 text-fg-3">{r.email || '—'}</td>
                  </tr>
                ))}
                {rows.length > 50 && (
                  <tr><td colSpan="4" className="px-3 py-2 text-fg-3 text-center">… y {rows.length - 50} más</td></tr>
                )}
              </tbody>
            </table>
          </div>
            )}

          <Button onClick={handleImport} disabled={importing || !courseId} className="w-full">
            {importing ? 'Importando…' : (rows.length > 0 ? `Importar ${rows.length} alumnos` : 'Importar alumnos')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="lg">
        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl">{error}</div>
        )}
        <DropZone onFile={handleFile} dragOver={dragOver} setDragOver={setDragOver} inputRef={inputRef} />
      </Card>

      <Card padding="md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-fg-0">Formato del archivo</h4>
            <p className="text-xs text-fg-2 mt-0.5">Columnas requeridas en la primera fila</p>
          </div>
          <DownloadTemplate
            columns={STUDENT_COLUMNS.map(c => c.replace(/"/g, ''))}
            filename="plantilla-alumnos.csv"
            examples={[STUDENT_EXAMPLE.map(c => c.replace(/^"|"$/g, ''))]}
          />
        </div>

            <div className="bg-bg-2 rounded-xl px-4 py-3 mb-4 overflow-x-auto">
              <code className="text-xs font-mono text-accent whitespace-nowrap">
                {STUDENT_COLUMNS.join(',')}
              </code>
            </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-fg-2">
          <p><span className="text-fg-0 font-medium">DNI</span> — 8 dígitos, solo números <span className="text-danger">*</span></p>
          <p><span className="text-fg-0 font-medium">Nombres</span> — Nombres del alumno <span className="text-danger">*</span></p>
          <p><span className="text-fg-0 font-medium">Apellidos</span> — Apellidos del alumno <span className="text-danger">*</span></p>
          <p><span className="text-fg-0 font-medium">Correo</span> — Email (opcional)</p>
        </div>
      </Card>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [tab, setTab] = useState('examenes');

  return (
    <div>
      <PageHead
        breadcrumb={['Importar']}
        title="Importar"
        subtitle="Importa preguntas y alumnos desde archivos CSV o XLSX"
      />
      <div className="p-6 max-w-[860px]">
        <Tabs tabs={TABS} activeKey={tab} onChange={setTab} className="mb-6" />
        {tab === 'examenes' && <ImportExamsTab />}
        {tab === 'alumnos' && <ImportStudentsTab />}
      </div>
    </div>
  );
}
