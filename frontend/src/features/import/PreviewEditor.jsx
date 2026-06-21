import { useState, useMemo, useRef } from 'react';
import { Button, Icon, Badge } from '../../design-system';

const QTYPE_LABELS = {
  MULTIPLE_CHOICE: 'Opción múltiple',
  BOOLEAN: 'Verdadero / Falso',
  SHORT_ANSWER: 'Respuesta corta',
};

const QTYPE_BADGE = {
  MULTIPLE_CHOICE: 'neutral',
  BOOLEAN: 'warning',
  SHORT_ANSWER: 'info',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'error', label: 'Con errores' },
  { value: 'MULTIPLE_CHOICE', label: 'Opción múltiple' },
  { value: 'BOOLEAN', label: 'V / F' },
  { value: 'SHORT_ANSWER', label: 'Respuesta corta' },
];

// ── Inline editable field ────────────────────────────────────────────────────

function EditField({ value, onChange, multiline, placeholder, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const ref = useRef(null);

  function commit() {
    setEditing(false);
    if (local !== value) onChange(local);
  }

  if (editing) {
    const shared = {
      ref,
      value: local,
      onChange: e => setLocal(e.target.value),
      onBlur: commit,
      onKeyDown: e => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setLocal(value); setEditing(false); }
      },
      autoFocus: true,
      className: `w-full bg-bg-1 border border-accent rounded-md px-2 py-1 text-sm text-fg-0 outline-none resize-none ${className}`,
    };
    return multiline ? <textarea rows={3} {...shared} /> : <input {...shared} />;
  }

  return (
    <div
      onClick={() => { setLocal(value); setEditing(true); }}
      className={`group relative cursor-text rounded-md px-2 py-1 hover:bg-bg-2 transition-colors min-h-[32px] ${className}`}
    >
      {value
        ? <span className="text-sm text-fg-0">{value}</span>
        : <span className="text-sm text-fg-3 italic">{placeholder || 'Clic para editar…'}</span>
      }
      <Icon name="edit" size={11} className="absolute right-1.5 top-1.5 text-fg-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ── Answer selector ──────────────────────────────────────────────────────────

function AnswerSelector({ row, onChange }) {
  if (row.question_type === 'MULTIPLE_CHOICE') {
    const correctSet = new Set(
      (row.correct_answer || '').toUpperCase().split(/[^A-D]+/).filter(k => /^[A-D]$/.test(k))
    );
    const defined = new Set(
      ['A', 'B', 'C', 'D'].filter(k => (row[`option_${k.toLowerCase()}`] || '').trim())
    );

    function toggle(key) {
      const next = new Set(correctSet);
      next.has(key) ? next.delete(key) : next.add(key);
      onChange([...next].sort().join(','));
    }

    return (
      <div className="flex gap-3 flex-wrap">
        {['A', 'B', 'C', 'D'].map(k => {
          const hasOption = defined.has(k);
          const isCorrect = correctSet.has(k);
          return (
            <label key={k} className={`flex items-center gap-1.5 cursor-pointer select-none ${!hasOption ? 'opacity-30 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                checked={isCorrect}
                disabled={!hasOption}
                onChange={() => toggle(k)}
                className="accent-accent w-4 h-4 rounded"
              />
              <span className={`text-sm font-semibold ${isCorrect ? 'text-ok' : 'text-fg-2'}`}>{k}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (row.question_type === 'BOOLEAN') {
    const val = (row.correct_answer || '').toLowerCase();
    return (
      <div className="flex gap-4">
        {[['true', 'Verdadero'], ['false', 'Falso']].map(([v, label]) => (
          <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="radio"
              name={`bool-${row._id}`}
              checked={val === v || (v === 'true' && val === 'verdadero') || (v === 'false' && val === 'falso')}
              onChange={() => onChange(v)}
              className="accent-accent w-4 h-4"
            />
            <span className="text-sm text-fg-1">{label}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <EditField
      value={row.correct_answer}
      onChange={onChange}
      placeholder="Palabras clave separadas por |"
    />
  );
}

// ── Question card ────────────────────────────────────────────────────────────

function QuestionCard({ row, index, dispatch }) {
  const [expanded, setExpanded] = useState(row._isNew || row._errors.length > 0);

  function update(patch) {
    dispatch({ type: 'UPDATE_ROW', payload: { id: row._id, patch } });
  }

  const hasErrors = row._errors.length > 0;
  const optionKeys = ['A', 'B', 'C', 'D'];

  return (
    <div className={`border rounded-xl transition-colors ${
      hasErrors ? 'border-danger/50 bg-danger/3' : 'border-line bg-bg-1'
    }`}>
      {/* Card header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Index badge */}
        <span className="shrink-0 w-7 h-7 rounded-full bg-bg-2 border border-line flex items-center justify-center text-xs font-semibold text-fg-2">
          {index + 1}
        </span>

        {/* Question text preview */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${row.text ? 'text-fg-0' : 'text-fg-3 italic'}`}>
            {row.text || 'Sin enunciado — clic para expandir y editar'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${
              row.question_type === 'MULTIPLE_CHOICE' ? 'bg-accent/10 text-accent border-accent/20' :
              row.question_type === 'BOOLEAN' ? 'bg-warn/10 text-warn border-warn/20' :
              'bg-fg-3/10 text-fg-2 border-fg-3/20'
            }`}>
              {QTYPE_LABELS[row.question_type] || row.question_type}
            </span>
            {row.category && (
              <span className="text-2xs text-fg-3 px-2 py-0.5 bg-bg-2 rounded-full border border-line">
                {row.category}
              </span>
            )}
            {row._isDirty && !row._isNew && (
              <span className="text-2xs text-accent font-medium">✎ editada</span>
            )}
            {row._isNew && (
              <span className="text-2xs text-ok font-medium">+ nueva</span>
            )}
            {hasErrors && (
              <span className="text-2xs text-danger font-medium">
                ● {row._errors.length} error{row._errors.length > 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            className="p-1.5 rounded-xl text-fg-3 hover:text-accent hover:bg-accent/10 transition-colors"
            title="Duplicar"
            onClick={() => dispatch({ type: 'DUPLICATE_ROW', payload: { id: row._id } })}
          >
            <Icon name="copy" size={14} />
          </button>
          <button
            className="p-1.5 rounded-xl text-fg-3 hover:text-danger hover:bg-danger/10 transition-colors"
            title="Eliminar"
            onClick={() => {
              if (deleteConfirmId === row._id) {
                dispatch({ type: 'DELETE_ROW', payload: { id: row._id } });
                setDeleteConfirmId(null);
              } else {
                setDeleteConfirmId(row._id);
                setTimeout(() => setDeleteConfirmId(prev => prev === row._id ? null : prev), 3000);
              }
            }}
          >
            {deleteConfirmId === row._id ? (
              <span className="text-xs text-danger font-medium">¿?</span>
            ) : (
              <Icon name="trash" size={14} />
            )}
          </button>
          <button className="p-1.5 rounded-xl text-fg-3 hover:text-fg-0 hover:bg-bg-2 transition-colors">
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-line/60 pt-4">
          {/* Errors */}
          {hasErrors && (
            <div className="flex flex-wrap gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl">
              {row._errors.map((e, i) => (
                <span key={i} className="text-xs text-danger">
                  <span className="font-semibold capitalize">{e.field}:</span> {e.message}
                </span>
              ))}
            </div>
          )}

          {/* Enunciado */}
          <div>
            <label className="block text-xs font-semibold text-fg-2 mb-1 uppercase tracking-wide">
              Enunciado <span className="text-danger">*</span>
            </label>
            <EditField
              value={row.text}
              onChange={v => update({ text: v })}
              multiline
              placeholder="Escribe el enunciado de la pregunta…"
              className="bg-bg-2 border border-line rounded-xl"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-fg-2 mb-1 uppercase tracking-wide">Tipo</label>
            <select
              value={row.question_type}
              onChange={e => update({ question_type: e.target.value, correct_answer: '', option_a: '', option_b: '', option_c: '', option_d: '' })}
              className="bg-bg-2 border border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent"
            >
              <option value="MULTIPLE_CHOICE">Opción múltiple</option>
              <option value="BOOLEAN">Verdadero / Falso</option>
              <option value="SHORT_ANSWER">Respuesta corta</option>
            </select>
          </div>

          {/* Options (MULTIPLE_CHOICE only) */}
          {row.question_type === 'MULTIPLE_CHOICE' && (
            <div>
              <label className="block text-xs font-semibold text-fg-2 mb-2 uppercase tracking-wide">
                Opciones <span className="text-danger">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {optionKeys.map(k => {
                  const field = `option_${k.toLowerCase()}`;
                  const correct = (row.correct_answer || '').toUpperCase().includes(k);
                  return (
                    <div key={k} className={`flex items-center gap-2 p-2 rounded-xl border ${
                      correct ? 'border-ok/40 bg-ok/5' : 'border-line bg-bg-2'
                    }`}>
                      <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        correct ? 'bg-ok text-white' : 'bg-bg-3 text-fg-2 border border-line'
                      }`}>
                        {k}
                      </span>
                      <EditField
                        value={row[field]}
                        onChange={v => update({ [field]: v })}
                        placeholder={`Opción ${k}…`}
                        className="flex-1 !px-0 !py-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Correct answer */}
          <div>
            <label className="block text-xs font-semibold text-fg-2 mb-2 uppercase tracking-wide">
              Respuesta correcta <span className="text-danger">*</span>
            </label>
            <AnswerSelector row={row} onChange={v => update({ correct_answer: v })} />
          </div>

          {/* Category + Explanation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-fg-2 mb-1 uppercase tracking-wide">Tema</label>
              <EditField
                value={row.category}
                onChange={v => update({ category: v })}
                placeholder="Ej: Anatomía, Álgebra…"
                className="bg-bg-2 border border-line rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-fg-2 mb-1 uppercase tracking-wide">Explicación</label>
              <EditField
                value={row.explanation}
                onChange={v => update({ explanation: v })}
                placeholder="Justificación opcional…"
                className="bg-bg-2 border border-line rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PreviewEditor({ state, dispatch, onConfirm }) {
  const { draftRows, search, filterType, currentPage, pageSize } = state;
  const debounceRef = useRef(null);
  const [localSearch, setLocalSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  function handleSearch(val) {
    setLocalSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => dispatch({ type: 'SET_SEARCH', payload: val }), 300);
  }

  const filtered = useMemo(() => {
    return draftRows
      .filter(row => {
        if (filterType === 'error') return row._errors.length > 0;
        if (filterType !== 'all') return row.question_type === filterType;
        return true;
      })
      .filter(row => !search || row.text.toLowerCase().includes(search.toLowerCase()));
  }, [draftRows, filterType, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages - 1);
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const errorCount = draftRows.filter(r => r._errors.length > 0).length;
  const dirtyCount = draftRows.filter(r => r._isDirty || r._isNew).length;
  const validCount = draftRows.filter(r => r._errors.length === 0).length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-fg-0">{draftRows.length} preguntas</span>
        <span className="text-fg-3">·</span>
        <span className="text-ok font-medium">{validCount} válidas</span>
        {errorCount > 0 && (
          <>
            <span className="text-fg-3">·</span>
            <button
              className="text-danger font-medium hover:underline"
              onClick={() => dispatch({ type: 'SET_FILTER_TYPE', payload: 'error' })}
            >
              {errorCount} con errores
            </button>
          </>
        )}
        {dirtyCount > 0 && (
          <>
            <span className="text-fg-3">·</span>
            <span className="text-accent font-medium">{dirtyCount} editadas</span>
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={localSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar pregunta..."
          className="flex-1 min-w-[180px] bg-bg-2 border border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent"
        />
        <div className="flex rounded-xl border border-line overflow-hidden">
          {FILTER_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => dispatch({ type: 'SET_FILTER_TYPE', payload: o.value })}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filterType === o.value ? 'bg-accent text-bg-1' : 'text-fg-2 hover:text-fg-0 hover:bg-bg-2'
              }`}
            >
              {o.label}
              {o.value === 'error' && errorCount > 0 && (
                <span className={`ml-1 ${filterType === 'error' ? 'text-bg-1/70' : 'text-danger'}`}>
                  {errorCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Icon name="plus" size={13} />}
          onClick={() => dispatch({ type: 'ADD_EMPTY_ROW' })}
        >
          Agregar pregunta
        </Button>
      </div>

      {/* Cards */}
      {pageRows.length === 0 ? (
        <div className="py-12 text-center text-fg-3 text-sm border border-dashed border-line rounded-xl">
          {search || filterType !== 'all' ? 'Sin resultados. Ajusta los filtros.' : 'No hay preguntas.'}
        </div>
      ) : (
        <div className="space-y-3">
          {pageRows.map((row, i) => (
            <QuestionCard
              key={row._id}
              row={row}
              index={page * pageSize + i}
              dispatch={dispatch}
            />
          ))}
        </div>
      )}

      {/* Pagination + Confirm */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-line">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => dispatch({ type: 'SET_PAGE', payload: page - 1 })}
          >
            <Icon name="chevron-left" size={14} />
          </Button>
          <span className="text-xs text-fg-2 min-w-[80px] text-center">
            {filtered.length === 0 ? '0 resultados' : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} de ${filtered.length}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => dispatch({ type: 'SET_PAGE', payload: page + 1 })}
          >
            <Icon name="chevron-right" size={14} />
          </Button>
        </div>
        <Button
          disabled={validCount === 0 || state.phase === 'confirming'}
          onClick={onConfirm}
          icon={<Icon name="check" size={14} />}
        >
          Confirmar importación ({validCount} pregunta{validCount !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );
}
