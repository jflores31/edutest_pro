/**
 * StudentProfilePage.jsx — Perfil detallado del alumno
 * Carga datos reales desde GET /api/v1/students/{id}/profile/
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card, Avatar, Skeleton } from '../../design-system';
import { Sparkline } from '../../features/charts';
import { useToast } from '../../features/toast/ToastProvider';
import { students as studentsApi } from '../../services/api';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeProfile(data) {
  const attempts = (data.attempts || []).map(a => ({
    id: a.id,
    exam: a.exam_title ?? '—',
    score: a.score != null ? Math.round(a.score * 10) / 10 : null,
    // score vigesimal: pass >= 11
    status: a.score != null ? (a.score >= 11 ? 'pass' : 'fail') : 'fail',
    date: formatDate(a.completed_at),
  }));

  const passCount = attempts.filter(a => a.status === 'pass').length;
  const scores = attempts.map(a => a.score).filter(s => s != null);
  const topicStats = data.topic_stats || [];

  return {
    id: data.id,
    code: data.code,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email || '—',
    course: data.course_name || '—',
    createdAt: formatDate(data.created_at),
    stats: {
      total_attempts: data.attempts_count ?? 0,
      avg_score: data.avg_score != null ? Math.round(data.avg_score * 10) / 10 : null,
      pass_rate: attempts.length > 0 ? Math.round((passCount / attempts.length) * 100) : 0,
      best_score: scores.length > 0 ? Math.max(...scores) : null,
      worst_score: scores.length > 0 ? Math.min(...scores) : null,
      ranking: data.ranking ?? null,
    },
    attempts,
    // temas con error_rate < 30% = fortalezas, > 50% = debilidades
    strengths: topicStats.filter(t => t.error_rate < 30).slice(0, 4).map(t => t.topic),
    weaknesses: topicStats.filter(t => t.error_rate >= 50).slice(0, 4).map(t => t.topic),
    // score_trend en escala 0-20
    scoreTrend: data.score_trend || [],
  };
}

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    setLoading(true);
    setError('');
    studentsApi.profile(id)
      .then(data => { if (alive) setStudent(normalizeProfile(data)); })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!student) return;
    setPdfLoading(true);
    try {
      await studentsApi.reportCardPdf(id, student.code);
    } catch (e) {
      toast.error('Error al generar PDF: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHead breadcrumb={['Alumnos', 'Perfil']} title="Cargando..." />
        <div className="p-6 space-y-4">
          <Skeleton height="120px" />
          <Skeleton height="200px" />
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div>
        <PageHead breadcrumb={['Alumnos', 'Perfil']} title="Error al cargar" />
        <div className="p-6">
          <Card padding="lg">
            <div className="text-center py-12">
              <Icon name="users" size={48} variant="soft" className="mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">No se pudo cargar el perfil</h3>
              <p className="text-sm text-fg-2 mb-4">{error}</p>
              <Button onClick={() => navigate('/teacher/students')}>Volver a alumnos</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const statusColors = {
    pass: { bg: 'bg-ok/10', text: 'text-ok', bar: 'var(--color-ok)' },
    fail: { bg: 'bg-danger/10', text: 'text-danger', bar: 'var(--color-danger)' },
  };

  return (
    <div>
      <PageHead
        breadcrumb={['Alumnos', `${student.firstName} ${student.lastName}`]}
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`${student.code} · ${student.course}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Icon name="download" size={14} />}
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Generando…' : 'Boletín PDF'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/teacher/students')}>
              Volver
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Info del alumno */}
        <Card>
          <div className="flex items-center gap-6">
            <Avatar name={`${student.firstName} ${student.lastName}`} size="lg" color="bg-accent-soft text-accent" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold text-fg-0">
                  {student.firstName} {student.lastName}
                </h2>
                <Badge variant="neutral">{student.code}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-fg-2">
                {student.email !== '—' && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="mail" size={14} /> {student.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Icon name="book" size={14} /> {student.course}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="clock" size={14} /> Miembro desde {student.createdAt}
                </span>
              </div>
            </div>
            {student.stats.ranking && (
              <div className="text-right">
                <div className="text-3xl font-bold text-fg-0">#{student.stats.ranking}</div>
                <div className="text-xs text-fg-2">en el curso</div>
              </div>
            )}
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Promedio</div>
            <div className={`text-2xl font-bold ${student.stats.avg_score != null && student.stats.avg_score >= 11 ? 'text-ok' : 'text-danger'}`}>
              {student.stats.avg_score != null ? `${student.stats.avg_score}/20` : '—'}
            </div>
          </Card>
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Aprobación</div>
            <div className="text-2xl font-bold text-fg-0">{student.stats.pass_rate}%</div>
          </Card>
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Mejor nota</div>
            <div className="text-2xl font-bold text-ok">
              {student.stats.best_score != null ? `${student.stats.best_score}/20` : '—'}
            </div>
          </Card>
          <Card padding="md">
            <div className="text-xs text-fg-2 mb-1">Intentos</div>
            <div className="text-2xl font-bold text-fg-0">{student.stats.total_attempts}</div>
          </Card>
        </div>

        {/* Tendencia + Fortalezas/Debilidades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {student.scoreTrend.length > 0 && (
            <Card title="Tendencia de rendimiento" subtitle={`Últimos ${student.scoreTrend.length} intentos`}>
              <div className="h-32">
                <Sparkline values={student.scoreTrend} color="var(--color-accent)" height={100} />
              </div>
            </Card>
          )}

          {(student.strengths.length > 0 || student.weaknesses.length > 0) && (
            <Card title="Fortalezas y debilidades">
              <div className="space-y-4">
                {student.strengths.length > 0 && (
                  <div>
                    <div className="text-xs text-fg-2 mb-2">Fortalezas</div>
                    <div className="flex flex-wrap gap-2">
                      {student.strengths.map(s => (
                        <Badge key={s} variant="success" dot>{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {student.weaknesses.length > 0 && (
                  <div>
                    <div className="text-xs text-fg-2 mb-2">Áreas de mejora</div>
                    <div className="flex flex-wrap gap-2">
                      {student.weaknesses.map(w => (
                        <Badge key={w} variant="danger" dot>{w}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Historial de intentos */}
        {student.attempts.length > 0 ? (
          <Card
            title="Historial de intentos"
            subtitle={`${student.attempts.length} intentos registrados`}
            padding="none"
          >
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Examen</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Resultado</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Progreso</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Fecha</th>
                  <th className="text-right text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {student.attempts.map(a => {
                  const sc = statusColors[a.status] ?? statusColors.fail;
                  const pct = a.score != null ? Math.round(a.score * 5) : 0;
                  return (
                    <tr key={a.id} className="border-b border-line/40 last:border-0 hover:bg-bg-2/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-fg-0">{a.exam}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          {a.status === 'pass' && <Icon name="check" size={10} />}
                          {a.score != null ? `${a.score}/20` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: sc.bar }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-2">{a.date}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/teacher/attempts/${a.id}`)}>
                          <Icon name="chevron-right" size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </Card>
        ) : (
          <Card padding="lg">
            <div className="text-center py-8">
              <Icon name="book" size={36} className="text-fg-3 mx-auto mb-3" />
              <p className="text-sm text-fg-2">Este alumno aún no ha realizado ningún intento</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
