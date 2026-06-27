/**
 * DashboardPage.jsx — Dashboard del docente (V3 — MD3)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Card, Button, Icon, Badge, Avatar } from '../../design-system';
import { DonutChart, BarChart, Heatmap, Histogram } from '../../features/charts';
import { dashboard as dashboardApi, courses as coursesApi } from '../../services/api';
import { KPICard, DonutSkeleton, BarSkeleton, ErrorBanner, LiveBanner, MobileAttemptCard, EmptyBanner, QuickActions } from '../../features/dashboard';
import { PERIODS, STATUS_COLORS, AVATAR_COLORS, buildHeatmapMatrix, buildHistogram, buildBarData, buildDonut, getAttemptVariant, formatDuration, formatRelative } from '../../utils/dashboard';
import { downloadCsv } from '../../utils/csv';
import { PASS_THRESHOLD } from '../../utils/score';

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <span className="text-fg-3 ml-1">↕</span>;
  return <span className="text-accent ml-1">{sort.dir === 'desc' ? '↓' : '↑'}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');

  const [courseId, setCourseId]   = useState('');
  const [courses, setCourses]     = useState([]);
  const [stats, setStats]         = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError]     = useState('');
  const [liveData, setLiveData]   = useState(null);
  const [liveCountdown, setLiveCountdown] = useState(15);
  const [sort, setSort]           = useState({ col: 'date', dir: 'desc' });

  useEffect(() => {
    let alive = true;
    coursesApi.list()
      .then(d => { if (alive) setCourses(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    setStatsLoading(true);
    setStatsError('');
    dashboardApi.stats(period, courseId)
      .then(data => { if (alive) { setStats(data); setStatsLoading(false); } })
      .catch(err  => { if (alive) { setStatsError(err.message); setStatsLoading(false); } });
    return () => { alive = false; };
  }, [period, courseId]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchLive = useCallback(() => {
    dashboardApi.live(courseId)
      .then(data => { if (mountedRef.current) { setLiveData(data); setLiveCountdown(15); } })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    fetchLive();
    const pollId = setInterval(() => { fetchLive(); }, 15_000);
    const tickId = setInterval(() => setLiveCountdown(c => Math.max(0, c - 1)), 1_000);
    return () => { clearInterval(pollId); clearInterval(tickId); };
  }, [fetchLive]);

  const handleRefresh = useCallback(() => {
    setStatsLoading(true);
    dashboardApi.stats(period, courseId)
      .then(data => { if (mountedRef.current) { setStats(data); setStatsLoading(false); } })
      .catch(err  => { if (mountedRef.current) { setStatsError(err.message); setStatsLoading(false); } });
    fetchLive();
  }, [period, courseId, fetchLive]);

  const handleSort = (col) => {
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const { matrix: heatmapMatrix, hours: heatmapHours } = useMemo(
    () => buildHeatmapMatrix(stats?.heatmap_by_hour), [stats],
  );
  const histogramBuckets = useMemo(() => buildHistogram(stats?.score_histogram), [stats]);
  const barData          = useMemo(() => buildBarData(stats?.exams_breakdown), [stats]);
  const donutData        = useMemo(
    () => buildDonut(stats?.total_attempts, stats?.pass_rate, stats?.abandonment_rate), [stats],
  );

  const sortedAttempts = useMemo(() => {
    const arr = stats?.recent_attempts ?? [];
    return [...arr].sort((a, b) => {
      const dir = sort.dir === 'desc' ? -1 : 1;
      if (sort.col === 'score')
        return dir * ((a.score ?? -1) - (b.score ?? -1));
      if (sort.col === 'duration') {
        const da = a.started_at && a.completed_at ? new Date(a.completed_at) - new Date(a.started_at) : 0;
        const db = b.started_at && b.completed_at ? new Date(b.completed_at) - new Date(b.started_at) : 0;
        return dir * (da - db);
      }
      return dir * (new Date(a.date || 0) - new Date(b.date || 0));
    });
  }, [stats?.recent_attempts, sort]);

  const isEmpty = !statsLoading && stats?.total_attempts === 0;
  const handleExport = () => {
    const rows = [
      ['Nombre', 'Examen', 'Nota', 'Estado', 'Fecha'],
      ...sortedAttempts.map(a => [a.user_name, a.exam, a.score ?? '', a.status, a.date]),
    ];
    downloadCsv('intentos.csv', rows);
  };

  const periodLabel    = PERIODS.find(p => p.key === period)?.label ?? period;
  const selectedCourse = courses.find(c => c.id === courseId);
  const contextSubtitle = liveData?.live_attempts > 0
    ? `${liveData.live_attempts} estudiante${liveData.live_attempts !== 1 ? 's' : ''} rindiendo ahora · ${periodLabel}`
    : `Período: ${periodLabel}${selectedCourse ? ` · ${selectedCourse.name}` : ''} · ${stats?.total_attempts ?? 0} intentos`;

  return (
    <div>
      <PageHead
        breadcrumb={['Dashboard']}
        title="Dashboard"
        subtitle={contextSubtitle}
        actions={
          <>
            {courses.length > 0 && (
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                className="bg-transparent border-2 border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent transition-colors h-[36px]"
              >
                <option value="">Todos los cursos</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <div className="flex rounded-xl bg-bg-2 overflow-hidden">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  disabled={statsLoading}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
                    period === p.key
                      ? 'bg-accent text-bg-1 shadow-sm'
                      : statsLoading
                        ? 'opacity-40 cursor-not-allowed text-fg-3'
                        : 'text-fg-2 hover:text-fg-0'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Button
              variant="secondary" size="sm"
              icon={<Icon name="download" size={14} />}
              onClick={handleExport}
            >
              Exportar
            </Button>
            <Button
              variant="ghost" size="sm"
              disabled={statsLoading}
              icon={<Icon name="refresh" size={14} className={statsLoading ? 'animate-spin' : ''} />}
              onClick={handleRefresh}
            />
          </>
        }
      />

      <div className="p-6 space-y-5">
        {/* 1. KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard
            icon="book" label="Exámenes"
            value={stats?.total_exams}
            foot={stats ? `${stats.exams_draft_count} en borrador` : undefined}
            loading={statsLoading}
          />
          <KPICard
            icon="users" label="Estudiantes"
            value={stats?.total_students}
            foot={stats?.total_attempts != null ? `${stats.total_attempts} intentos` : undefined}
            loading={statsLoading}
          />
          <KPICard
            icon="award" label="Nota media"
            value={stats?.avg_score != null ? Number(stats.avg_score.toFixed(1)) : undefined}
            suffix="/20"
            delta={stats?.delta_avg_score}
            foot={stats?.avg_time_minutes != null ? `Duración: ${Math.round(stats.avg_time_minutes)} min` : undefined}
            loading={statsLoading}
          />
          <KPICard
            icon="trend" label="Aprobación"
            value={stats?.pass_rate != null ? Number(stats.pass_rate.toFixed(1)) : undefined}
            suffix="%"
            delta={stats?.delta_pass_rate}
            loading={statsLoading}
          />
          <KPICard
            icon="alert" label="Abandono"
            value={stats?.abandonment_rate != null ? Number(stats.abandonment_rate.toFixed(1)) : undefined}
            suffix="%"
            delta={stats?.delta_abandonment_rate}
            invertDelta
            loading={statsLoading}
          />
        </div>

        {/* 2. Live banner */}
        <LiveBanner data={liveData} countdown={liveCountdown} />

        {/* Error */}
        {statsError && <ErrorBanner message={statsError} onRetry={handleRefresh} />}

        {/* Estado vacío */}
        {isEmpty && <EmptyBanner />}

        {/* 3. Intentos recientes */}
        <Card
          title="Intentos recientes"
          subtitle={stats ? `Últimos ${sortedAttempts.length} registros completados` : 'Cargando…'}
          variant="elevated"
          headerAction={
            <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/students')}>
              Ver todos <Icon name="chevron-right" size={12} className="ml-1" />
            </Button>
          }
          padding="none"
        >
          {statsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse bg-bg-2 rounded-xl" />)}
            </div>
          ) : !sortedAttempts.length ? (
            <div className="text-center text-fg-3 text-sm py-8">No hay intentos completados aún</div>
          ) : (
            <>
              <div className="block sm:hidden">
                {sortedAttempts.map((a, i) => (
                  <MobileAttemptCard key={a.id} attempt={a} index={i} />
                ))}
              </div>

              <table className="hidden sm:table w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Estudiante</th>
                    <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Examen</th>
                    <th
                      className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5 cursor-pointer hover:text-fg-0 select-none"
                      onClick={() => handleSort('score')}
                    >
                      Nota <SortIcon col="score" sort={sort} />
                    </th>
                    <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Progreso</th>
                    <th
                      className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5 cursor-pointer hover:text-fg-0 select-none"
                      onClick={() => handleSort('duration')}
                    >
                      Duración <SortIcon col="duration" sort={sort} />
                    </th>
                    <th
                      className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5 cursor-pointer hover:text-fg-0 select-none"
                      onClick={() => handleSort('date')}
                    >
                      Fecha <SortIcon col="date" sort={sort} />
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {sortedAttempts.map((a, i) => {
                    const variant = getAttemptVariant(a.score);
                    const sc = STATUS_COLORS[variant];
                    const scorePct = a.score != null ? Math.round((a.score / 20) * 100) : 0;
                    return (
                      <tr
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver intento de ${a.user_name} en ${a.exam}`}
                        className="border-b border-line/40 last:border-0 hover:bg-bg-2/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/teacher/attempts/${a.id}`)}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/teacher/attempts/${a.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={a.user_name} size="sm" color={AVATAR_COLORS[i % 5]} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-fg-0 truncate">{a.user_name}</div>
                              <div className="text-2xs text-fg-3 truncate">{a.user_email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-fg-1">{a.exam}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                            {variant === 'pass' && <Icon name="check" size={10} strokeWidth={2.5} />}
                            {a.score != null ? `${a.score.toFixed(1)}/20` : a.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="w-full h-1.5 bg-bg-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${scorePct}%`, background: sc.bar, animationDelay: `${i * 50}ms` }}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-fg-2 font-mono">{formatDuration(a.started_at, a.completed_at)}</td>
                        <td className="px-5 py-3.5 text-sm text-fg-3">{formatRelative(a.date)}</td>
                        <td className="px-5 py-3.5">
                          <Icon name="chevron-right" size={14} className="text-fg-3" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Card>

        {/* 4. Donut + Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card
            title="Resultados de intentos"
            subtitle={stats ? `Distribución de ${stats.total_attempts} intentos` : 'Cargando…'}
            variant="elevated"
            headerAction={
              <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/compare')}>
                Ver detalle <Icon name="chevron-right" size={12} className="ml-1" />
              </Button>
            }
          >
            {statsLoading ? <DonutSkeleton /> : <DonutChart {...donutData} />}
          </Card>

          <Card
            title="Promedio por examen"
            subtitle={`Línea punteada = umbral de aprobación (≥ ${PASS_THRESHOLD}/20)`}
            variant="elevated"
            headerAction={
              <div className="flex items-center gap-3 text-2xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ok" /> ≥ {PASS_THRESHOLD}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn" /> {`< ${PASS_THRESHOLD}`}</span>
              </div>
            }
          >
            {statsLoading ? <BarSkeleton /> : <BarChart data={barData} threshold={PASS_THRESHOLD} maxValue={20} />}
          </Card>
        </div>

        {/* 5. Histogram + Heatmap + Top Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <Card title="Distribución de notas" subtitle={stats ? `${stats.total_attempts} intentos por rango` : 'Cargando…'} variant="elevated">
            {statsLoading
              ? (
                <div className="flex items-end gap-3 h-[130px] pt-1">
                  {[20, 45, 75, 90, 55].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5" style={{ minWidth: 36, maxWidth: 72 }}>
                      <div className="w-full rounded-t animate-pulse bg-bg-3" style={{ height: `${h}%` }} />
                      <div className="h-3 w-6 bg-bg-3 rounded animate-pulse" />
                      <div className="h-2 w-10 bg-bg-3 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )
              : <Histogram buckets={histogramBuckets} />}
          </Card>

          <Card title="Actividad por horario" subtitle="Cuándo rinden los alumnos" variant="elevated">
            {statsLoading
              ? (
                <div className="flex flex-col gap-1">
                  <div className="grid gap-1" style={{ gridTemplateColumns: '14px repeat(7, 1fr)' }}>
                    <span />
                    {[1,2,3,4,5,6,7].map(i => <div key={i} className="h-3 bg-bg-3 rounded animate-pulse" />)}
                  </div>
                  {[1,2,3,4,5,6,7].map(di => (
                    <div key={di} className="grid gap-1" style={{ gridTemplateColumns: '14px repeat(7, 1fr)' }}>
                      <div className="h-4 bg-bg-3 rounded animate-pulse" />
                      {[1,2,3,4,5,6,7].map(hi => (
                        <div key={hi} className="h-[18px] rounded-[3px] bg-bg-3 animate-pulse" />
                      ))}
                    </div>
                  ))}
                </div>
              )
              : <Heatmap data={heatmapMatrix} hours={heatmapHours} />}
          </Card>

          <Card
            title="Preguntas más falladas" subtitle="Top por % de error"
            variant="elevated"
            headerAction={<Badge variant="warning" dot>Atención</Badge>}
          >
            {statsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-8 animate-pulse bg-bg-2 rounded-xl" />)}
              </div>
            ) : stats?.top_failed_questions?.length ? (
              <div>
                {stats.top_failed_questions.map((q, i) => (
                  <div key={q.question_id} className="flex items-center gap-3 py-2.5 border-b border-line/40 last:border-0">
                    <span className="text-2xs text-fg-3 font-mono w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-fg-0 leading-tight truncate">{q.question_text}</div>
                      {q.category && <div className="text-2xs text-fg-2 mt-0.5">{q.category}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-danger tabular-nums">{q.error_rate}%</div>
                      <div className="text-2xs text-fg-3">incorrectas</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-fg-3 text-sm py-6">Sin datos suficientes aún</div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <QuickActions stats={stats} liveData={liveData} />
      </div>
    </div>
  );
}
