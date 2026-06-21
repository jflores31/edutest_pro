/**
 * StudentResultsPage.jsx — Pantalla de resultados post-examen
 * Lee los datos del backend desde location.state.result
 * Muestra condicionalmente según settings: show_score, show_answers, show_explanations
 */
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon, Badge, Card, Button } from '../../design-system';

const PASS_THRESHOLD = 11;

function getScoreColor(score, passed) {
  if (passed) return 'text-ok';
  if (score == null) return 'text-fg-0';
  return score >= PASS_THRESHOLD * 0.6 ? 'text-warn' : 'text-danger';
}

function getScoreLabel(score, passed) {
  if (passed) return 'Aprobado';
  if (score == null) return '—';
  return score >= PASS_THRESHOLD * 0.6 ? 'En proceso' : 'Desaprobado';
}

function getScoreVariant(score, passed) {
  if (passed) return 'ok';
  if (score == null) return 'neutral';
  return score >= PASS_THRESHOLD * 0.6 ? 'warn' : 'danger';
}

export default function StudentResultsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result;

  // ── No data ──
  if (!result) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="bg-bg-1 border border-line rounded-2xl p-8 max-w-md w-full text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-warn/10 mx-auto mb-4">
            <Icon name="info" size={28} className="text-warn" />
          </div>
          <h1 className="text-xl font-semibold text-fg-0 mb-2">Resultados no disponibles</h1>
          <p className="text-sm text-fg-2 mb-6">
            No se encontraron los resultados de este examen. Puede que el examen no se haya enviado correctamente.
          </p>
          <Button onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
            Volver al inicio
          </Button>
        </div>
      </div>
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

  // ── Teacher disabled all results ──
  if (!showScore && !showAnswers) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="bg-bg-1 border border-line rounded-2xl p-8 max-w-md w-full text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-ok/10 mx-auto mb-4">
            <Icon name="check" size={28} className="text-ok" />
          </div>
          <h1 className="text-xl font-semibold text-fg-0 mb-2">Examen completado</h1>
          <p className="text-sm text-fg-2 mb-6">Tu examen ha sido enviado correctamente.</p>
          <Button onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  // ── Full results ──
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-bg-1 border-b border-line">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-center">
          <div className={`grid h-16 w-16 place-items-center rounded-full mx-auto mb-4 ${
            passed ? 'bg-ok/10' : score != null ? 'bg-danger/10' : 'bg-warn/10'
          }`}>
            <Icon name="check" size={28} className={passed ? 'text-ok' : score != null ? 'text-danger' : 'text-warn'} />
          </div>
          <h1 className="text-2xl font-semibold text-fg-0 mb-1">Examen completado</h1>
          {studentName && <p className="text-sm font-medium text-fg-1 mb-1">{studentName}</p>}
          <p className="text-sm text-fg-2">Revisa tus resultados a continuación</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Score card */}
        {showScore && (
          <Card padding="md">
            <div className="text-center py-4">
              <div className={`text-5xl font-bold tabular-nums mb-2 ${getScoreColor(score, passed)}`}>
                {score != null ? score.toFixed(1) : '—'}
                <span className="text-2xl text-fg-3 font-normal">/{result.score_max || 20}</span>
              </div>
              <Badge variant={getScoreVariant(score, passed)} className="mb-3">
                {getScoreLabel(score, passed)}
              </Badge>
              <p className="text-sm text-fg-2">
                {earnedPoints} de {totalPoints} punto{totalPoints !== 1 ? 's' : ''} obtenido{totalPoints !== 1 ? 's' : ''}
              </p>
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

        {/* Volver */}
        <div className="text-center pb-8">
          <Button onClick={() => navigate(`/exam/${slug}`, { replace: true })}>
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
