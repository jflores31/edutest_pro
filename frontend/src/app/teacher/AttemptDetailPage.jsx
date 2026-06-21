/**
 * AttemptDetailPage.jsx — Detalle de un intento de examen
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card } from '../../design-system';
import { attempts } from '../../services/api';

const STATUS_COLORS = {
  COMPLETED: 'ok',
  IN_PROGRESS: 'accent',
  ABANDONED: 'warn',
};

const STATUS_LABELS = {
  COMPLETED: 'Completado',
  IN_PROGRESS: 'En progreso',
  ABANDONED: 'Abandonado',
};

export default function AttemptDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    setLoading(true);
    attempts.detail(id)
      .then(data => { if (alive) setAttempt(data); })
      .catch(err => { if (alive) setError(err.message || 'Error al cargar el intento'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div>
        <PageHead breadcrumb={['Intentos', 'Cargando...']} title="Detalle del intento" />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-bg-2 rounded w-1/3" />
            <div className="h-4 bg-bg-2 rounded w-1/2" />
            <div className="h-64 bg-bg-2 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div>
        <PageHead breadcrumb={['Intentos']} title="Detalle del intento" />
        <div className="p-6">
          <Card>
            <div className="text-center py-12">
              <Icon name="alert" size={48} className="text-danger mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">Error</h3>
              <p className="text-sm text-fg-2 mb-4">{error || 'Intento no encontrado'}</p>
              <Button variant="secondary" onClick={() => navigate(-1)}>Volver</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[attempt.status] || 'neutral';
  const statusLabel = STATUS_LABELS[attempt.status] || attempt.status;

  return (
    <div>
      <PageHead
        breadcrumb={['Intentos', attempt.exam_title]}
        title="Detalle del intento"
        subtitle={`${attempt.student_name || attempt.user_name || 'Estudiante'} · ${attempt.exam_title}`}
      />

      <div className="p-6 space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Estado</div>
            <Badge variant={statusColor}>{statusLabel}</Badge>
          </Card>
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Puntaje</div>
            <div className="text-2xl font-bold text-fg-0">
              {attempt.score != null ? `${attempt.score}/20` : '—'}
            </div>
          </Card>
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Duración</div>
            <div className="text-sm text-fg-0">
              {attempt.started_at && new Date(attempt.started_at).toLocaleString('es-PE')}
              {attempt.completed_at && (
                <>
                  <br />
                  <span className="text-fg-2">
                    → {new Date(attempt.completed_at).toLocaleString('es-PE')}
                  </span>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Respuestas */}
        {attempt.answers && attempt.answers.length > 0 && (
          <Card title="Respuestas" subtitle={`${attempt.answers.length} preguntas respondidas`}>
            <div className="space-y-4">
              {attempt.answers.map((a, i) => (
                <div key={a.question_id} className="border border-line rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-fg-3 bg-bg-2 px-2 py-0.5 rounded">
                          {i + 1}
                        </span>
                        {a.topic && (
                          <span className="text-xs text-fg-3 bg-bg-2 px-2 py-0.5 rounded">
                            {a.topic}
                          </span>
                        )}
                        {a.is_correct !== null && (
                          <Badge variant={a.is_correct ? 'ok' : 'danger'}>
                            {a.is_correct ? 'Correcta' : 'Incorrecta'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-fg-0 mb-2">{a.question_text}</p>
                      {a.student_answer != null && (
                        <div className="text-xs text-fg-2">
                          <span className="font-medium">Respuesta:</span>{' '}
                          {typeof a.student_answer === 'object'
                            ? (a.student_answer?.selected_key ?? a.student_answer?.selected_keys?.join(', ') ?? '—')
                            : String(a.student_answer)}
                        </div>
                      )}
                      {a.explanation && (
                        <p className="text-xs text-fg-2 mt-1 italic">{a.explanation}</p>
                      )}
                    </div>
                    {a.time_spent != null && (
                      <span className="text-xs text-fg-3 whitespace-nowrap">
                        {a.time_spent}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Temas débiles */}
        {attempt.weak_topics && attempt.weak_topics.length > 0 && (
          <Card title="Temas a reforzar" subtitle="Temas con mayor tasa de error">
            <div className="space-y-2">
              {attempt.weak_topics.map((wt, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <span className="text-sm text-fg-0">{wt.topic}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-fg-2">
                      {wt.errors} de {wt.total} errores
                    </span>
                    <div className="w-24 h-2 bg-bg-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-danger rounded-full"
                        style={{ width: `${Math.min(100, wt.error_rate)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-danger">{wt.error_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <Icon name="chevron-left" size={14} /> Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
