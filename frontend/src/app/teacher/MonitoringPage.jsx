/**
 * MonitoringPage.jsx — Monitoreo en vivo de exámenes
 * Polls /dashboard/live/ every 15 s for active attempts
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card, Avatar, Skeleton } from '../../design-system';
import { dashboard as dashboardApi } from '../../services/api';

const STATUS_MAP = {
  normal: { label: 'Normal', variant: 'success' },
  warning: { label: 'Alerta', variant: 'warning' },
  danger: { label: 'Riesgo', variant: 'danger' },
  offline: { label: 'Sin conexión', variant: 'neutral' },
  finishing: { label: 'Finalizando', variant: 'accent' },
};

function deriveStatus(lastHeartbeat, progressPct) {
  if (!lastHeartbeat) return 'offline';
  const secsSinceHb = (Date.now() - new Date(lastHeartbeat).getTime()) / 1000;
  if (secsSinceHb > 60) return 'offline';
  if (progressPct >= 100) return 'finishing';
  return 'normal';
}

function formatHeartbeat(iso) {
  if (!iso) return 'nunca';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return 'ahora';
  if (secs < 60) return `hace ${secs}s`;
  return `hace ${Math.floor(secs / 60)}min`;
}

function normalizeAttempt(a) {
  const answered = a.progress?.answered ?? 0;
  const total = a.progress?.total ?? 1;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const status = deriveStatus(a.last_heartbeat, progressPct);
  return {
    id: a.id,
    name: a.student_name ?? '—',
    code: a.student_code ?? '—',
    exam: a.exam_title ?? '—',
    examId: a.exam_id,
    progress: progressPct,
    timeRemaining: '—',
    heartbeat: formatHeartbeat(a.last_heartbeat),
    proctoringEvents: a.proctoring_events ?? 0,
    status,
  };
}

export default function MonitoringPage() {
  const [attempts, setAttempts] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedExam, setSelectedExam] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await dashboardApi.live();
      if (!mountedRef.current) return;
      const active = data.latest_attempts ?? [];
      const normalized = active.map(normalizeAttempt);
      setAttempts(normalized);

      const uniqueExams = [];
      const seen = new Set();
      normalized.forEach(a => {
        if (a.examId && !seen.has(a.examId)) {
          seen.add(a.examId);
          uniqueExams.push({ id: a.examId, title: a.exam });
        }
      });
      setExams(uniqueExams);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const filtered = useMemo(() => {
    if (selectedExam === 'all') return attempts;
    return attempts.filter(a => String(a.examId) === selectedExam);
  }, [attempts, selectedExam]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return { total_active: 0, avg_progress: 0, alerts: 0, finishing: 0 };
    return {
      total_active: filtered.length,
      avg_progress: Math.round(filtered.reduce((sum, a) => sum + a.progress, 0) / filtered.length),
      alerts: filtered.filter(a => a.proctoringEvents > 0).length,
      finishing: filtered.filter(a => a.status === 'finishing').length,
    };
  }, [filtered]);

  return (
    <div>
      <PageHead
        breadcrumb={['Monitoreo']}
        title="Monitoreo en vivo"
        subtitle={`${stats.total_active} alumnos activos`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant={autoRefresh ? 'primary' : 'secondary'}
              size="sm"
              icon={<Icon name="refresh" size={13} />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-actualizando' : 'Pausado'}
            </Button>
            <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={13} />} onClick={load}>
              Actualizar
            </Button>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              className="bg-transparent border-2 border-line rounded-xl px-3 py-1.5 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
            >
              <option value="all">Todos los exámenes</option>
              {exams.map(exam => (
                <option key={exam.id} value={String(exam.id)}>{exam.title}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-center justify-between p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={load}>Reintentar</Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10">
                <Icon name="users" size={18} className="text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.total_active}</div>
                <div className="text-xs text-fg-2">Alumnos activos</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ok/10">
                <Icon name="trend" size={18} className="text-ok" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.avg_progress}%</div>
                <div className="text-xs text-fg-2">Progreso promedio</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-warn/10">
                <Icon name="bell" size={18} className="text-warn" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.alerts}</div>
                <div className="text-xs text-fg-2">Alertas</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10">
                <Icon name="check" size={18} className="text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.finishing}</div>
                <div className="text-xs text-fg-2">Finalizando</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} height="48px" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="eye" size={48} className="text-fg-3 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">Sin alumnos activos</h3>
              <p className="text-sm text-fg-2">No hay exámenes en curso en este momento</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Alumno</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Examen</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Progreso</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Heartbeat</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Estado</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const status = STATUS_MAP[a.status] || STATUS_MAP.normal;
                  return (
                    <tr key={a.id} className="border-b border-line/40 last:border-0 hover:bg-bg-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={a.name}
                            size="sm"
                            color={
                              a.status === 'danger' ? 'bg-danger/20 text-danger' :
                              a.status === 'warning' ? 'bg-warn/20 text-warn' :
                              'bg-accent-soft text-accent'
                            }
                          />
                          <div>
                            <div className="text-sm font-medium text-fg-0">{a.name}</div>
                            <div className="text-2xs text-fg-3">{a.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-1">{a.exam}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, a.progress)}%`,
                                background: a.progress >= 100 ? 'var(--color-ok)' : a.progress >= 60 ? 'var(--color-accent)' : 'var(--color-warn)',
                              }}
                            />
                          </div>
                          <span className="text-xs text-fg-2">{Math.round(a.progress)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-2">{a.heartbeat}</td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant} dot>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {a.proctoringEvents > 0 ? (
                          <Badge variant="danger">{a.proctoringEvents} eventos</Badge>
                        ) : (
                          <span className="text-xs text-fg-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
