import { isMultiAnswer } from '../../utils/questionType';

export function SingleChoice({ q, value, onChange }) {
  return (
    <div className="space-y-2.5">
      {q.options.map(opt => {
        const sel = value === opt.id;
        return (
          <label key={opt.id}
            className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all
              ${sel ? 'border-accent bg-accent/10' : 'border-line hover:border-fg-3 hover:bg-bg-2'}`}>
            <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
              ${sel ? 'border-accent' : 'border-fg-3'}`}>
              {sel && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </span>
            <input type="radio" name={q.id} checked={sel} onChange={() => onChange(opt.id)} className="sr-only" />
            <span className="text-fg-1 text-sm leading-relaxed">{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

export function MultipleChoice({ q, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = id => {
    const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id];
    onChange(next);
  };
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-fg-3 mb-3">Selecciona todas las que apliquen</p>
      {q.options.map(opt => {
        const chk = selected.includes(opt.id);
        return (
          <label key={opt.id}
            className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all
              ${chk ? 'border-accent bg-accent/10' : 'border-line hover:border-fg-3 hover:bg-bg-2'}`}>
            <span className={`mt-0.5 w-5 h-5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-all
              ${chk ? 'border-accent bg-accent' : 'border-fg-3'}`}>
              {chk && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <input type="checkbox" checked={chk} onChange={() => toggle(opt.id)} className="sr-only" />
            <span className="text-fg-1 text-sm leading-relaxed">{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

export function BooleanChoice({ value, onChange }) {
  const opts = [{ id: true, label: 'Verdadero', icon: '✓' }, { id: false, label: 'Falso', icon: '✗' }];
  return (
    <div className="grid grid-cols-2 gap-4">
      {opts.map(o => (
        <button key={String(o.id)} onClick={() => onChange(o.id)}
          className={`py-6 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-2
            ${value === o.id
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line text-fg-1 hover:border-fg-3 hover:bg-bg-2'}`}>
          <span className="text-2xl">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ShortAnswer({ value, onChange }) {
  return (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={5}
      placeholder="Escribe tu respuesta aquí…"
      className="w-full bg-bg-2 border border-line rounded-xl p-4 text-fg-0 text-sm outline-none
        focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y transition-all" />
  );
}

export function QuestionBody({ q, value, onChange }) {
  if (q.type === 'single_choice' || q.type === 'MULTIPLE_CHOICE_SINGLE')
    return <SingleChoice q={q} value={value} onChange={onChange} />;
  if (q.type === 'multiple_choice' || q.type === 'MULTIPLE_CHOICE_MULTIPLE')
    return <MultipleChoice q={q} value={value} onChange={onChange} />;
  if (q.type === 'MULTIPLE_CHOICE') {
    // El snapshot del alumno está saneado (sin correct_keys) y trae la pista
    // `multiple`; para el docente/preview, correct_keys sí está presente.
    return isMultiAnswer(q.metadata)
      ? <MultipleChoice q={q} value={value} onChange={onChange} />
      : <SingleChoice q={q} value={value} onChange={onChange} />;
  }
  if (q.type === 'boolean' || q.type === 'BOOLEAN')
    return <BooleanChoice value={value} onChange={onChange} />;
  return <ShortAnswer value={value} onChange={onChange} />;
}