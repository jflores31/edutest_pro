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

  return (
    <div className="min-h-screen bg-bg grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft mx-auto mb-4">
            <Icon name="file" size={24} className="text-accent" strokeWidth={1.6} />
          </div>
          {examInfo ? (
            <>
              <h1 className="text-xl font-semibold text-fg-0">{examInfo.title}</h1>
              <p className="text-sm text-fg-3 mt-1">
                {examInfo.duration_minutes} min · {examInfo.questions_count} preguntas
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-5 w-48 bg-bg-2 rounded-xl animate-pulse mx-auto" />
              <div className="h-3 w-32 bg-bg-2 rounded-xl animate-pulse mx-auto" />
            </div>
          )}
        </div>

        {/* Error de servidor */}
        {serverError && (
          <div className="bg-danger-soft border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl text-center">
            {serverError}
          </div>
        )}

        {/* Paso 1: ingresar DNI */}
        {step === 'input' && (
          <form onSubmit={onLookup} className="bg-bg-1 shadow-card rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-xs text-fg-2 font-medium mb-2">
                DNI del alumno
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={dni}
                onChange={e => { setDni(e.target.value.replace(/\D/g, '')); setDniError(''); }}
                placeholder="12345678"
                autoFocus
                className="w-full bg-transparent border-2 border-line rounded-xl px-4 py-3 text-fg-0 text-lg
                  font-mono tracking-widest text-center outline-none focus:border-accent
                  focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-fg-3"
              />
              {dniError && <p className="text-danger text-xs mt-1.5">{dniError}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting || dni.length !== 8}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                text-bg-1 font-medium py-3 rounded-xl transition-all text-sm shadow-sm"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-bg-1 border-t-transparent animate-spin" />
                  Buscando…
                </span>
              ) : 'Continuar'}
            </button>
          </form>
        )}

        {/* Paso 2: confirmar identidad */}
        {step === 'confirm' && student && (
          <div className="bg-bg-1 shadow-card rounded-2xl p-6 space-y-5">
            <div>
              <p className="text-xs text-fg-3 font-medium uppercase tracking-wider mb-3">¿Eres tú?</p>
              <div className="bg-bg-2 rounded-xl px-4 py-4">
                <p className="text-xl font-semibold text-fg-0">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-fg-3 mt-0.5 font-mono">DNI: {student.code}</p>
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
                  font-medium transition-all shadow-sm"
              >
                Sí, comenzar examen
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
      </div>
    </div>
  );
}
