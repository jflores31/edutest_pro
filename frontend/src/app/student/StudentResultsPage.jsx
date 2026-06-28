/**
 * StudentResultsPage.jsx — Pantalla de resultados post-examen
 * Lee los datos del backend desde location.state.result
 * Muestra condicionalmente según settings: show_score, show_answers, show_explanations
 */
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon, Badge, Card, Button } from '../../design-system';
import { PASS_THRESHOLD } from '../../utils/score';
import StatusScreen from '../../components/StatusScreen';
import { printHtml } from '../../utils/certificate';
import { attempts } from '../../services/api';

export default function StudentResultsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result;
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState(null);

  // El certificado se genera en el backend (regla "solo aprobados"); aquí solo se
  // pide e imprime. El token de certificado viaja en la respuesta de submit.
  async function handleDownloadCertificate() {
    if (!result?.passed || !result.attempt_id) return;
    setCertError(null);
    setCertLoading(true);
    try {
      const html = await attempts.certificate(result.attempt_id, { token: result.certificate_token });
      printHtml(html);
    } catch (e) {
      setCertError(e.message || 'No se pudo generar el certificado.');
    } finally {
      setCertLoading(false);
    }
  }

  // ── No data ──
  if (!result) {
    return (
      <StatusScreen
        icon="info"
        tone="warn"
        maxWidth="md"
        title="Resultados no disponibles"
        message="No se encontraron los resultados de este examen. Puede que el examen no se haya enviado correctamente."
        action={
          <Button onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
            Volver al inicio
          </Button>
        }
      />
    );
  }

  const settings = result.settings || {};
  const showScore = settings.show_score === true;
  const showAnswers = settings.show_answers === true;
  const showExplanations = settings.show_explanations === true;
  const breakdown = result.breakdown || [];
  const weakTopics = result.weak_topics || [];
  const score = result.score ?? null;
  const passed = result.passed ?? false;
  const earnedPoints = result.earned_points ?? 0;
  const totalPoints = result.total_points ?? 0;
  const studentName = result.student_name || '';
  const firstName = studentName.trim().split(/\s+/)[0] || '';

  // ── Teacher disabled all results ──
  if (!showScore && !showAnswers) {
    return (
      <StatusScreen
        icon="check"
        tone="ok"
        maxWidth="md"
        title="Examen completado"
        message="Tu examen ha sido enviado correctamente."
        action={
          <Button onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
            Volver al inicio
          </Button>
        }
      />
    );
  }

  // ── Full results ──
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero — celebra al aprobar / alienta al desaprobar (solo si se muestra la nota) */}
      {showScore ? (
        <div className={`border-b ${passed ? 'bg-ok-soft border-ok/25' : 'bg-danger-soft border-danger/25'}`}>
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-12 text-center">
            <div className={`grid h-20 w-20 place-items-center rounded-full mx-auto mb-5 ${passed ? 'bg-ok/15' : 'bg-danger/15'}`}>
              <Icon name={passed ? 'award' : 'refresh'} size={38} strokeWidth={1.8} className={passed ? 'text-ok' : 'text-danger'} />
            </div>
            <h1 className={`text-2xl md:text-3xl font-bold mb-2 text-balance ${passed ? 'text-ok' : 'text-danger'}`}>
              {passed ? '¡Felicidades! Aprobaste el examen 🎉' : 'No aprobaste esta vez'}
            </h1>
            <p className="text-sm md:text-base text-fg-1 max-w-md mx-auto leading-relaxed">
              {passed
                ? `¡Excelente trabajo${firstName ? `, ${firstName}` : ''}! Demostraste lo que sabes. Sigue así. 💪`
                : `${firstName ? `${firstName}, n` : 'N'}o alcanzaste la nota mínima (${PASS_THRESHOLD}/20), pero estás en el camino. Repasa los temas marcados e inténtalo de nuevo. ¡Tú puedes! 🌱`}
            </p>
            {studentName && <p className="text-xs text-fg-3 mt-4">{studentName}</p>}
          </div>
        </div>
      ) : (
        <div className="bg-bg-1 border-b border-line">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full mx-auto mb-4 bg-ok/10">
              <Icon name="check" size={28} className="text-ok" />
            </div>
            <h1 className="text-2xl font-semibold text-fg-0 mb-1">Examen completado</h1>
            {studentName && <p className="text-sm font-medium text-fg-1 mb-1">{studentName}</p>}
            <p className="text-sm text-fg-2">Revisa tus respuestas a continuación</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Score card */}
        {showScore && (
          <Card padding="md">
            <div className={`text-center py-5 rounded-xl ${passed ? 'bg-ok/[0.04]' : 'bg-danger/[0.04]'}`}>
              <div className={`text-6xl font-bold tabular-nums mb-2 ${passed ? 'text-ok' : 'text-danger'}`}>
                {score != null ? score.toFixed(1) : '—'}
                <span className="text-2xl text-fg-3 font-normal">/{result.score_max || 20}</span>
              </div>
              <Badge variant={passed ? 'ok' : 'danger'} className="mb-3">
                {passed ? 'Aprobado' : 'Desaprobado'}
              </Badge>
              <p className="text-sm text-fg-2">
                {earnedPoints} de {totalPoints} punto{totalPoints !== 1 ? 's' : ''} obtenido{totalPoints !== 1 ? 's' : ''}
              </p>
              {!passed && score != null && PASS_THRESHOLD - score > 0 && (
                <p className="text-xs text-danger mt-2 font-medium">
                  Te faltaron {(PASS_THRESHOLD - score).toFixed(1)} puntos para aprobar (mínimo {PASS_THRESHOLD}/20)
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Per-question breakdown */}
        {showAnswers && breakdown.length > 0 && (
          <Card title="Resultados por pregunta" subtitle={`${breakdown.length} pregunta${breakdown.length !== 1 ? 's' : ''}`}>
            <div className="divide-y divide-line">
              {breakdown.map((item, i) => (
                <div key={item.question_id || i} className={`py-4 first:pt-0 last:pb-0 ${item.is_correct ? '' : 'bg-danger/[0.02] -mx-5 px-5'}`}>
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.is_correct ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
                    }`}>
                      {item.is_correct
                        ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                      }
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Question number + text */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-fg-3 font-mono">{i + 1}.</span>
                        <p className="text-sm text-fg-0 font-medium">{item.question_text}</p>
                      </div>

                      {/* Your answer + correct answer */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <div className={`p-2.5 rounded-xl text-xs ${
                          item.is_correct ? 'bg-ok/5 border border-ok/20' : 'bg-danger/5 border border-danger/20'
                        }`}>
                          <span className="text-fg-3">Tu respuesta:</span>
                          <span className={`ml-1 font-medium ${item.is_correct ? 'text-ok' : 'text-danger'}`}>
                            {item.your_answer || 'Sin responder'}
                          </span>
                        </div>
                        {!item.is_correct && (
                          <div className="p-2.5 rounded-xl text-xs bg-ok/5 border border-ok/20">
                            <span className="text-fg-3">Correcta:</span>
                            <span className="ml-1 font-medium text-ok">{item.correct_answer || '—'}</span>
                          </div>
                        )}
                      </div>

                      {/* Meta row: topic + points + explanation */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        {item.topic && (
                          <span className="text-2xs text-fg-3 bg-bg-2 px-2 py-0.5 rounded">
                            {item.topic}
                          </span>
                        )}
                        <span className="text-2xs text-fg-3">
                          {item.points_earned ?? 0}/{item.points_possible ?? 1} pts
                        </span>
                        {showExplanations && item.explanation && (
                          <details className="w-full mt-1">
                            <summary className="text-2xs text-accent cursor-pointer hover:underline">
                              Ver explicación
                            </summary>
                            <p className="mt-1.5 text-xs text-fg-2 bg-bg-2 p-2.5 rounded-xl leading-relaxed">
                              {item.explanation}
                            </p>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Correct/incorrect summary */}
        {showAnswers && breakdown.length > 0 && (() => {
          const correct = breakdown.filter(b => b.is_correct).length;
          const incorrect = breakdown.length - correct;
          return (
            <div className="grid grid-cols-2 gap-3">
              <Card padding="md">
                <div className="text-center">
                  <div className="text-2xs text-fg-3 mb-0.5">Correctas</div>
                  <div className="text-2xl font-bold text-ok tabular-nums">{correct}</div>
                  <div className="text-2xs text-fg-3">{breakdown.length > 0 ? Math.round((correct / breakdown.length) * 100) : 0}%</div>
                </div>
              </Card>
              <Card padding="md">
                <div className="text-center">
                  <div className="text-2xs text-fg-3 mb-0.5">Incorrectas</div>
                  <div className="text-2xl font-bold text-danger tabular-nums">{incorrect}</div>
                  <div className="text-2xs text-fg-3">{breakdown.length > 0 ? Math.round((incorrect / breakdown.length) * 100) : 0}%</div>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* Weak topics */}
        {showAnswers && weakTopics.length > 0 && (
          <Card title="Temas a reforzar" subtitle="Temas donde tuviste más errores">
            <div className="space-y-2">
              {weakTopics.map((wt, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <span className="text-sm text-fg-0">{wt.topic}</span>
                  <span className="text-xs text-fg-2">{wt.errors} error{wt.errors !== 1 ? 'es' : ''}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Acciones */}
        <div className="text-center pb-8 space-y-3">
          {passed && (
            <div>
              <Button
                variant="secondary"
                onClick={handleDownloadCertificate}
                disabled={certLoading}
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                }
              >
                {certLoading ? 'Generando…' : 'Descargar certificado'}
              </Button>
              {certError && <p className="text-xs text-danger mt-2">{certError}</p>}
            </div>
          )}
          <div>
            <Button onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
