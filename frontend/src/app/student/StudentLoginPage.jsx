/**
 * StudentLoginPage.jsx — Login de alumno en dos pasos (MD3)
 * 1. Ingresa DNI → lookup → muestra nombre
 * 2. Confirma identidad → login → redirige al examen
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, exams } from '../../services/api';
import { Icon } from '../../design-system';

export default function StudentLoginPage() {
  const { slug } = useParams();
  const navigate  = useNavigate();

  const [examInfo, setExamInfo]   = useState(null);
  const [examError, setExamError] = useState('');

  const [dni, setDni]               = useState('');
  const [dniError, setDniError]     = useState('');
  const [step, setStep]             = useState('input');
  const [student, setStudent]       = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    let alive = true;
    exams.getPublic(slug)
      .then(d => { if (alive) setExamInfo(d); })
      .catch(e => { if (alive) setExamError(e.message || 'Examen no encontrado'); });
    return () => { alive = false; };
  }, [slug]);

  async function onLookup(ev) {
    ev.preventDefault();
    const clean = dni.replace(/\D/g, '');
    if (!/^\d{8}$/.test(clean)) {
      setDniError('El DNI debe tener exactamente 8 dígitos');
      return;
    }
    setDniError('');
    setServerError('');
    setSubmitting(true);
    try {
      const data = await auth.studentLookup(slug, clean);
      setStudent({ ...data, code: clean });
      setStep('confirm');
    } catch (e) {
      setServerError(e.message || 'DNI no encontrado en este examen');
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm() {
    setStep('loading');
    setServerError('');
    try {
      const data = await auth.studentLogin(slug, student.code);
      localStorage.setItem('attempt_token', data.attempt_token);
      localStorage.setItem('attempt_id',    data.attempt_id);
      if (data.ends_at)       localStorage.setItem('attempt_ends_at',   data.ends_at);
      localStorage.setItem('attempt_block_tab', JSON.stringify(data.block_tab_switch ?? false));
      navigate(`/exam/${slug}/run`);
    } catch (e) {
      setServerError(e.message || 'No se pudo iniciar el examen');
      setStep('input');
    }
  }

  if (examError) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center p-6">
        <div className="bg-bg-1 shadow-card border border-danger/20 rounded-2xl p-8 max-w-sm w-full text-center">
          <Icon name="alert" size={24} className="text-danger mx-auto mb-3" />
          <p className="text-danger text-sm">{examError}</p>
        </div>
      </div>
    );
  }

  const complete = dni.length === 8;

  return (
    <div className="relative min-h-screen bg-bg grid place-items-center p-6 overflow-hidden">
      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-accent-soft blur-3xl opacity-70" />
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-ic-violet-soft blur-3xl opacity-50" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-hover shadow-card mx-auto mb-4">
            <Icon name="file" size={28} className="text-bg-1" strokeWidth={1.7} />
          </div>
          {examInfo ? (
            <>
              <h1 className="text-xl font-semibold text-fg-0 text-balance">{examInfo.title}</h1>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 bg-bg-1 border border-line rounded-full px-3 py-1 text-xs text-fg-2">
                  <Icon name="clock" size={13} className="text-fg-3" />
                  {examInfo.duration_minutes} min
                </span>
                <span className="inline-flex items-center gap-1.5 bg-bg-1 border border-line rounded-full px-3 py-1 text-xs text-fg-2">
                  <Icon name="file" size={13} className="text-fg-3" />
                  {examInfo.questions_count} preguntas
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-5 w-48 bg-bg-2 rounded-xl animate-pulse mx-auto" />
              <div className="h-6 w-40 bg-bg-2 rounded-full animate-pulse mx-auto" />
            </div>
          )}
        </div>

        {/* Error de servidor */}
        {serverError && (
          <div className="bg-danger-soft border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl flex items-center gap-2" role="alert">
            <Icon name="alert" size={16} className="shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Paso 1: ingresar DNI */}
        {step === 'input' && (
          <form onSubmit={onLookup} className="bg-bg-1 shadow-card rounded-2xl p-6 space-y-5">
            <div className="text-center">
              <h2 className="text-base font-semibold text-fg-0">Identifícate para comenzar</h2>
              <p className="text-sm text-fg-3 mt-1">Ingresa tu número de documento</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="dni" className="block text-xs text-fg-2 font-medium">
                  DNI del alumno
                </label>
                <span
                  className={`text-2xs font-mono tabular-nums transition-colors ${complete ? 'text-ok' : 'text-fg-3'}`}
                  aria-hidden="true"
                >
                  {dni.length}/8
                </span>
              </div>

              <div className="relative">
                <input
                  id="dni"
                  name="dni"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={dni}
                  onChange={e => { setDni(e.target.value.replace(/\D/g, '')); setDniError(''); }}
                  placeholder="12345678"
                  autoFocus
                  aria-invalid={!!dniError}
                  aria-describedby="dni-help"
                  className={`w-full bg-bg-2 border-2 rounded-xl pl-4 pr-11 py-4 text-fg-0 text-2xl
                    font-mono tracking-[0.35em] text-center outline-none transition-all placeholder:text-fg-3/60
                    ${dniError
                      ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
                      : 'border-line focus:border-accent focus:ring-2 focus:ring-accent/20'}`}
                />
                {complete && !dniError && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-ok-soft">
                    <Icon name="check" size={15} className="text-ok" strokeWidth={2.2} />
                  </span>
                )}
              </div>

              {/* Indicador segmentado de progreso (8 dígitos) */}
              <div className="flex gap-1.5 justify-center mt-3" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-5 rounded-full transition-colors duration-150
                      ${i < dni.length ? (complete ? 'bg-ok' : 'bg-accent') : 'bg-line'}`}
                  />
                ))}
              </div>

              {dniError
                ? <p className="text-danger text-xs mt-2 text-center" role="alert">{dniError}</p>
                : <p id="dni-help" className="text-fg-3 text-2xs mt-2 text-center">Solo números, sin puntos ni espacios</p>}
            </div>

            <button
              type="submit"
              disabled={submitting || !complete}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                text-bg-1 font-medium py-3.5 rounded-xl transition-all text-sm shadow-sm
                flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-bg-1 border-t-transparent animate-spin" />
                  Buscando…
                </>
              ) : (
                <>
                  Continuar
                  <Icon name="chevron-right" size={16} strokeWidth={2} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Paso 2: confirmar identidad */}
        {step === 'confirm' && student && (
          <div className="bg-bg-1 shadow-card rounded-2xl p-6 space-y-5">
            <p className="text-xs text-fg-3 font-medium uppercase tracking-wider text-center">¿Eres tú?</p>
            <div className="bg-bg-2 rounded-xl p-5 flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent font-semibold text-lg">
                {(student.first_name?.[0] || '') + (student.last_name?.[0] || '')}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-fg-0 truncate">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-fg-3 mt-0.5 font-mono">DNI {student.code}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('input'); setStudent(null); setServerError(''); }}
                className="flex-1 border-2 border-line text-fg-1 py-3 rounded-xl text-sm font-medium
                  hover:bg-bg-2 transition-colors"
              >
                No soy yo
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 bg-accent hover:bg-accent-hover text-bg-1 py-3 rounded-xl text-sm
                  font-medium transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Icon name="check" size={16} strokeWidth={2} />
                Comenzar
              </button>
            </div>
          </div>
        )}

        {/* Paso 3: iniciando */}
        {step === 'loading' && (
          <div className="bg-bg-1 shadow-card rounded-2xl p-8 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm text-fg-2">Iniciando examen…</p>
          </div>
        )}

        {/* Pie tranquilizador */}
        <p className="flex items-center justify-center gap-1.5 text-2xs text-fg-3">
          <Icon name="shield" size={12} />
          Tus respuestas se guardan automáticamente
        </p>
      </div>
    </div>
  );
}
