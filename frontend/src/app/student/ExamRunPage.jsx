/**
 * ExamRunPage.jsx — Interfaz de examen en curso
 * Features: timer, autosave, heartbeat, proctoring (tab-switch / focus-lost),
 * detección de offline, barra de progreso, mapa de preguntas, responsive móvil.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setStudentToken, attempts } from '../../services/api';
import { QuestionBody } from '../../features/student/QuestionRenderers';
import { isAnswered } from '../../utils/answers';
import StatusScreen from '../../components/StatusScreen';

// ─── helpers ────────────────────────────────────────────────────────────────

function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

function fmtRemaining(ms) {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1_000);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Normaliza el snapshot del backend al formato que espera el frontend
function normalizeSnapshot(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    title: raw.title || raw.exam_title,
    questions: (raw.questions || []).map(q => ({
      id: q.id || q.question_id,
      text: q.text || q.question_text,
      type: q.type || q.question_type,
      order: q.order,
      points: q.points,
      version_number: q.version_number,
      metadata: q.metadata,
      options: q.options || (q.metadata?.options || []).map(opt => ({
        id: opt.id || opt.key,
        text: opt.text,
      })),
    })),
  };
}

// Las respuestas guardadas vuelven envueltas ({selected_keys:[...]} múltiple,
// {selected_key:"A"} única, {value:bool} V/F); los renderers esperan el valor
// "desnudo" (array para múltiple, escalar para única/V-F/texto). Sin esto, al
// reanudar/recargar el examen las respuestas no aparecían marcadas.
function unwrapSavedAnswer(ad) {
  if (ad && typeof ad === 'object' && !Array.isArray(ad)) {
    if (Array.isArray(ad.selected_keys)) return ad.selected_keys;
    if ('selected_key' in ad) return ad.selected_key;
    if ('value' in ad) return ad.value;
    if ('selected' in ad) return ad.selected;
  }
  return ad;
}

// ─── OfflineOverlay ──────────────────────────────────────────────────────────

function OfflineOverlay({ onRetry }) {
  return (
    <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="alertdialog" aria-modal="true" aria-label="Sin conexión a internet">
      <div className="bg-bg-1 border border-line rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
        <div className="w-14 h-14 rounded-full bg-warn/10 grid place-items-center mx-auto mb-4">
          <svg className="w-7 h-7 text-warn" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-fg-0 font-semibold text-lg mb-1">Sin conexión</h2>
        <p className="text-fg-2 text-sm mb-6">
          Tus respuestas están guardadas localmente. Reconecta para continuar.
        </p>
        <button onClick={onRetry}
          className="w-full bg-accent hover:bg-accent-hover text-bg-1 font-medium py-2.5 rounded-xl transition text-sm">
          Reintentar conexión
        </button>
      </div>
    </div>
  );
}

// ─── ProctoringToast ─────────────────────────────────────────────────────────

// El componente se monta con `key` única por evento, por lo que cada aviso
// reinicia su propio temporizador. El toast se muestra al *regresar* a la
// pestaña (cuando la página vuelve a estar visible) para que el setTimeout no
// quede throttleado en segundo plano y el aviso sí desaparezca solo.
function ProctoringToast({ message, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, 5000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-warn text-white pl-4 pr-2 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in max-w-[92vw]">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="min-w-0">{message}</span>
      <button
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="flex-shrink-0 grid place-items-center h-6 w-6 rounded-lg hover:bg-white/20 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── ExamRunPage ─────────────────────────────────────────────────────────────

export default function ExamRunPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const attemptId  = useRef(localStorage.getItem('attempt_id'));
  const tok = localStorage.getItem('attempt_token');
  if (tok) setStudentToken(tok);
  const endsAtIso  = useRef(localStorage.getItem('attempt_ends_at'));

  // ── State ──────────────────────────────────────────────────────────────────
  const [exam, setExam]         = useState(null);
  const [answers, setAnswers]   = useState({});
  const [idx, setIdx]           = useState(0);
  const [savedAt, setSavedAt]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [offline, setOffline]   = useState(!navigator.onLine);
  const [toast, setToast]       = useState(null); // { id, msg }
  const [visited, setVisited]   = useState({});   // preguntas que el alumno ya vio
  const [tabSwitches, setTabSwitches] = useState(0); // nº de salidas de pestaña detectadas
  const [finishing, setFinishing] = useState(false);

  // ── Toast de proctoring (clave única por aviso → reinicia su temporizador) ──
  const toastIdRef = useRef(0);
  const showToast = useCallback((msg) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, msg });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // ── Redirect si no hay sesión o token mock obsoleto ──────────────────────
  useEffect(() => {
    const id = attemptId.current;
    const currentToken = localStorage.getItem('attempt_token');
    const isMock = !id || !currentToken || id.startsWith('mock-') || currentToken.startsWith('mock-');
    if (isMock) {
      localStorage.removeItem('attempt_token');
      localStorage.removeItem('attempt_id');
      localStorage.removeItem('attempt_ends_at');
      localStorage.removeItem('attempt_block_tab');
      navigate(`/exam/${slug}`, { replace: true });
    }
  }, [slug, navigate]);

  // ── Cargar snapshot ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!attemptId.current) return;

    let alive = true;
    (async () => {
      try {
        const data = await attempts.state(attemptId.current);
        if (!alive) return;

        setExam(normalizeSnapshot(data.exam_snapshot || data));

        // Sync timer from server in case localStorage was cleared (page refresh)
        if (data.time_remaining_seconds != null && !endsAtIso.current) {
          const computed = new Date(Date.now() + data.time_remaining_seconds * 1000).toISOString();
          endsAtIso.current = computed;
          localStorage.setItem('attempt_ends_at', computed);
        }

        const init = {};
        if (data.saved_answers && typeof data.saved_answers === 'object' && !Array.isArray(data.saved_answers)) {
          Object.entries(data.saved_answers).forEach(([qId, val]) => { init[qId] = unwrapSavedAnswer(val); });
        } else {
          (data.saved_answers || data.answers || []).forEach(a => {
            init[a.question_id] = unwrapSavedAnswer(a.answer_data ?? a.value);
          });
        }
        setAnswers(init);
        setLoading(false);
      } catch (e) {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const endsAtMs  = endsAtIso.current ? new Date(endsAtIso.current).getTime() : null;
  const timed     = endsAtMs !== null;
  const remaining = timed ? Math.max(0, endsAtMs - now) : null;
  const expired   = timed && remaining === 0;
  const lowTime   = timed && remaining > 0 && remaining < 5 * 60_000;
  const critTime  = timed && remaining > 0 && remaining < 60_000;

  // ── Auto-finish cuando expire (solo exámenes con límite de tiempo) ────────
  const expiredFinishRef = useRef(false);
  useEffect(() => {
    if (timed && expired && !expiredFinishRef.current) {
      expiredFinishRef.current = true;
      doFinish();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally constrained
  }, [timed, expired]);

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!attemptId.current) return;
    const id = setInterval(() => {
      attempts.heartbeat(attemptId.current).catch(() => {});
    }, 25_000);
    return () => clearInterval(id);
  }, []);

  // ── Aviso al recargar / cerrar con el examen en curso ───────────────────
  // Evita perder el examen por una recarga o cierre accidental. Se desactiva
  // cuando ya se está entregando (`finishing`). En navegación SPA (al ir a
  // resultados) este evento no se dispara, así que no estorba.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (finishing) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [finishing]);

  // ── Marca la pregunta actual como "vista" ────────────────────────────────
  // Permite distinguir en el mapa una pregunta saltada (visitada pero sin
  // responder → ámbar) de una que el alumno aún no ha abierto (neutral).
  useEffect(() => {
    const cur = (exam?.questions || [])[idx];
    if (!cur) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marcar "vista" al cambiar de pregunta es la sincronización deseada
    setVisited(v => (v[cur.id] ? v : { ...v, [cur.id]: true }));
  }, [exam, idx]);

  // ── Offline detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, []);

  // ── Proctoring — tab switch / focus lost ──────────────────────────────────
  const sendEvent = useCallback((type) => {
    if (!attemptId.current) return;
    attempts.event(attemptId.current, type, { ts: new Date().toISOString() }).catch(() => {});
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        // El alumno salió de la pestaña: registramos el evento y contamos la salida.
        // NO mostramos el toast aquí porque su temporizador quedaría throttleado en
        // segundo plano (ver fix en ProctoringToast).
        sendEvent('TAB_SWITCH');
        setTabSwitches(n => n + 1);
      } else {
        // El alumno volvió: ahora la pestaña está activa, mostramos el aviso y su
        // temporizador corre con normalidad (desaparece solo a los 5 s).
        sendEvent('RECONNECT');
        showToast('Saliste de la pestaña del examen. Esto quedó registrado.');
      }
    };
    const onBlur = () => {
      sendEvent('FOCUS_LOST');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [sendEvent, showToast]);

  // ── Auto-save con debounce 600 ms ─────────────────────────────────────────
  const saveTimers = useRef({});
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear all pending debounce timers on unmount
      Object.values(saveTimers.current).forEach(clearTimeout);
      saveTimers.current = {};
    };
  }, []);

  function saveAnswer(qId, value) {
    setAnswers(a => ({ ...a, [qId]: value }));
    clearTimeout(saveTimers.current[qId]);
    saveTimers.current[qId] = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const answer_data = Array.isArray(value)
          ? { selected_keys: value }
          : { selected_key: value };
        await attempts.answer(attemptId.current, qId, answer_data);
        if (mountedRef.current) setSavedAt(Date.now());
      } catch { /* sin conexión: se guarda en state y reintenta */ }
    }, 600);
  }

  // ── Finalizar ─────────────────────────────────────────────────────────────
  const pendingCount = (exam?.questions || []).filter(qq => !isAnswered(answers[qq.id])).length;

  function confirmFinish() {
    setShowFinishConfirm(true);
  }

  function cancelFinish() {
    setShowFinishConfirm(false);
  }

  async function doFinish() {
    setShowFinishConfirm(false);
    setFinishing(true);
    try {
      const data = await attempts.finish(attemptId.current);
      localStorage.removeItem('attempt_token');
      localStorage.removeItem('attempt_id');
      localStorage.removeItem('attempt_ends_at');
      localStorage.removeItem('attempt_snapshot');
      localStorage.removeItem('attempt_block_tab');
      navigate(`/exam/${slug}/results`, { state: { result: data, attemptId: attemptId.current, examTitle: exam?.title } });
    } catch {
      setError('No se pudo finalizar el examen. Verifica tu conexión.');
      setFinishing(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-bg grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span className="text-fg-2 text-sm">Cargando examen…</span>
      </div>
    </div>
  );

  if (error) return (
    <StatusScreen
      icon="alert"
      tone="danger"
      title="No se pudo cargar el examen"
      message={error}
      action={
        <button onClick={() => window.location.reload()} className="text-xs text-fg-2 underline">
          Reintentar
        </button>
      }
    />
  );

  if (!exam) return null;

  // ── Data ──────────────────────────────────────────────────────────────────
  const questions = exam.questions || [];
  const q         = questions[idx];
  const total     = questions.length;
  const answered  = questions.filter(qq => isAnswered(answers[qq.id])).length;
  // Saltadas = visitadas pero sin responder (las que el alumno abrió y dejó en blanco)
  const skippedCount = questions.filter(qq => visited[qq.id] && !isAnswered(answers[qq.id])).length;
  const progress  = total > 0 ? (answered / total) * 100 : 0;
  const savedAgo  = savedAt ? Math.max(1, Math.round((now - savedAt) / 1000)) : null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* Proctoring toast (keyed → cada aviso reinicia su temporizador) */}
      {toast && <ProctoringToast key={toast.id} message={toast.msg} onClose={clearToast} />}

      {/* Offline overlay */}
      {offline && <OfflineOverlay onRetry={() => { if (navigator.onLine) setOffline(false); }} />}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-line bg-bg-1 px-4 md:px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        {/* Título */}
        <div className="flex-1 min-w-0">
          <p className="text-2xs uppercase tracking-widest text-fg-3 hidden sm:block">Examen</p>
          <p className="text-fg-0 font-medium text-sm truncate">{exam.title}</p>
        </div>

        {/* Salidas de pestaña (proctoring) */}
        {tabSwitches > 0 && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 text-2xs font-medium text-warn bg-warn/10 border border-warn/30 rounded-full px-2.5 py-1 flex-shrink-0"
            title="Cada vez que sales de la pestaña queda registrado"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Salidas: {tabSwitches}
          </span>
        )}

        {/* Guardado */}
        <span className="hidden md:flex items-center gap-1 text-xs flex-shrink-0">
          {savedAgo == null ? (
            <span className="text-fg-3">Sin cambios pendientes</span>
          ) : savedAgo <= 2 ? (
            <span className="inline-flex items-center gap-1 text-ok">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Guardado
            </span>
          ) : (
            <span className="text-fg-3">Guardado hace {savedAgo}s</span>
          )}
        </span>

        {/* Timer */}
        <div className={`font-mono text-xl md:text-2xl tabular-nums px-3 py-1 rounded-xl flex-shrink-0 transition-colors
          ${critTime ? 'bg-danger/15 text-danger animate-pulse'
            : lowTime ? 'bg-warn/15 text-warn'
              : 'text-fg-0'}`}>
          {timed ? fmtRemaining(remaining) : '∞'}
        </div>

        {/* Finalizar */}
        <button onClick={confirmFinish} disabled={finishing}
          className="bg-accent hover:bg-accent-hover disabled:opacity-60 text-bg-1 font-medium
            px-3 md:px-5 py-2 rounded-xl text-sm transition flex-shrink-0">
          {finishing ? 'Finalizando…' : 'Finalizar'}
        </button>
      </header>

      {/* Low time warning */}
      {lowTime && !critTime && (
        <div className="bg-warn/10 border-b border-warn/30 text-warn text-sm font-medium px-4 py-2 text-center">
          Quedan menos de 5 minutos. Revisa tus respuestas.
        </div>
      )}
      {critTime && (
        <div className="bg-danger/15 border-b border-danger/30 text-danger text-sm font-medium px-4 py-2 text-center animate-pulse">
          ¡Último minuto! El examen se entregará automáticamente al llegar a 0.
        </div>
      )}

      {/* ── Barra de progreso ─────────────────────────────────────────────── */}
      <div className="h-[3px] bg-bg-2 flex-shrink-0"
        role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total}
        aria-label="Progreso del examen">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Cuerpo ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[220px_1fr] gap-4 md:gap-6 p-4 md:p-6 max-w-6xl w-full mx-auto pb-24 md:pb-6">

        {/* Mapa de preguntas */}
        <aside className="bg-bg-1 border border-line rounded-xl p-4 h-max md:sticky md:top-20 order-2 md:order-1">
          <p className="text-2xs uppercase tracking-widest text-fg-3 mb-1">Preguntas</p>
          <p className="text-fg-2 text-xs mb-3">
            <span className={answered === total ? 'text-ok font-medium' : ''}>{answered}</span>/{total} respondidas
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((qq, i) => {
              const done    = isAnswered(answers[qq.id]);
              const active  = i === idx;
              const pending = !done && !active && visited[qq.id]; // visitada pero sin responder
              return (
                <button key={qq.id} onClick={() => setIdx(i)}
                  title={pending ? 'Sin responder' : undefined}
                  className={`relative h-9 rounded-xl text-xs font-medium border transition-all
                    ${active
                      ? 'border-accent bg-accent/15 text-accent'
                      : done
                        ? 'border-ok/40 bg-ok/10 text-ok'
                        : pending
                          ? 'border-warn/60 bg-warn/10 text-warn'
                          : 'border-line text-fg-2 hover:border-fg-3 hover:bg-bg-2'}`}>
                  {i + 1}
                  {active && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warn" />
                  )}
                  {pending && (
                    <span className="absolute -top-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-warn text-white text-[8px] font-bold leading-none">!</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Aviso de preguntas saltadas */}
          {skippedCount > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-2xs text-warn bg-warn/10 border border-warn/30 rounded-lg px-2.5 py-1.5">
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-warn text-white text-[8px] font-bold leading-none">!</span>
              {skippedCount} pregunta{skippedCount !== 1 ? 's' : ''} sin responder
            </p>
          )}

          {/* Leyenda */}
          <div className="mt-4 space-y-1.5 text-2xs text-fg-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-ok/40 bg-ok/10" />Respondida
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative w-3 h-3 rounded border border-accent bg-accent/15">
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warn" />
              </span>Actual
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-warn/60 bg-warn/10" />Sin responder
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-line" />Sin ver
            </div>
          </div>
        </aside>

        {/* Pregunta actual */}
        <main className="bg-bg-1 border border-line rounded-xl p-6 md:p-8 order-1 md:order-2">
          {/* Cabecera de pregunta */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs uppercase tracking-widest text-fg-3">
              Pregunta {idx + 1} de {total}
            </span>
            {(q.metadata?.category || q.metadata?.topic) && (
              <span className="text-2xs bg-bg-2 border border-line text-fg-2 px-2 py-0.5 rounded-full">
                {q.metadata.category || q.metadata.topic}
              </span>
            )}
          </div>

          <h2 className="text-fg-0 text-base md:text-lg leading-snug font-medium mb-6 md:mb-8">
            {q.text || q.question_text}
          </h2>

          <QuestionBody q={q} value={answers[q.id]} onChange={v => saveAnswer(q.id, v)} />

          {/* Navegación desktop */}
          <div className="hidden md:flex justify-between items-center mt-10 pt-6 border-t border-line">
            <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
              className="px-4 py-2 rounded-xl border border-line text-fg-1 text-sm
                hover:bg-bg-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Anterior
            </button>
            <span className="text-xs text-fg-3">{idx + 1} / {total}</span>
            {idx < total - 1 ? (
              <button onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
                className="px-4 py-2 rounded-xl bg-bg-2 border border-line text-fg-0 text-sm
                  hover:bg-bg-3 transition-colors">
                Siguiente →
              </button>
            ) : (
              <button onClick={confirmFinish} disabled={finishing}
                className="px-4 py-2 rounded-xl bg-accent text-bg-1 font-medium text-sm
                  hover:bg-accent-hover disabled:opacity-60 transition">
                {finishing ? 'Finalizando…' : 'Finalizar examen'}
              </button>
            )}
          </div>
        </main>
      </div>

      {/* ── Barra móvil inferior ──────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-line bg-bg-1 px-4 py-3 flex gap-3 z-10">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="flex-1 py-2.5 rounded-xl border border-line text-fg-1 text-sm font-medium
            disabled:opacity-40 hover:bg-bg-2 transition-colors">
          Anterior
        </button>
        {idx < total - 1 ? (
          <button onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            className="flex-[2] py-2.5 rounded-xl bg-accent text-bg-1 text-sm font-medium
              hover:bg-accent-hover transition">
            Siguiente
          </button>
        ) : (
          <button onClick={confirmFinish} disabled={finishing}
            className="flex-[2] py-2.5 rounded-xl bg-accent text-bg-1 text-sm font-medium
              disabled:opacity-60 hover:bg-accent-hover transition">
            {finishing ? 'Finalizando…' : 'Finalizar examen'}
          </button>
        )}
      </div>

      {/* ── Confirmar finalización ─────────────────────────────────────── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="alertdialog" aria-modal="true" aria-label="Confirmar finalización del examen">
          <div className="bg-bg-1 border border-line rounded-2xl p-6 max-w-sm w-full shadow-pop">
            <h3 className="text-fg-0 font-semibold text-lg mb-2">¿Finalizar examen?</h3>
            <p className="text-fg-2 text-sm mb-2">Esta acción no se puede deshacer.</p>
            {pendingCount > 0 ? (
              <p className="text-warn text-sm font-medium mb-4 bg-warn/10 p-3 rounded-xl">
                Te quedan <span className="font-bold">{pendingCount}</span> pregunta{pendingCount !== 1 ? 's' : ''} sin responder.
              </p>
            ) : (
              <p className="text-ok text-sm mb-4 bg-ok/10 p-3 rounded-xl">
                Has respondido todas las preguntas.
              </p>
            )}
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={cancelFinish}
                className="px-4 py-2 text-sm font-medium text-fg-1 hover:bg-bg-2 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={() => doFinish()} disabled={finishing}
                className="px-4 py-2 text-sm font-medium bg-accent text-bg-1 rounded-xl hover:bg-accent-hover disabled:opacity-60 transition">
                {finishing ? 'Finalizando…' : 'Sí, entregar examen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
