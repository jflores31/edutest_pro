/**
 * ComparePage.jsx — Comparativa entre exámenes
 * Conectado al API real: GET /api/v1/exams/ para lista,
 * GET /api/v1/exams/compare/?ids=... para datos comparativos
 */
import { useState, useEffect, useMemo } from 'react';
import { PageHead } from '../../layout';
import { Icon, Card, Input, Skeleton } from '../../design-system';
import { BarChart } from '../../features/charts';
import { exams as examsApi } from '../../services/api';
import { PASS_THRESHOLD, isPassing } from '../../utils/score';

const DISTRIBUTION_LABELS = ['0-5', '5-8', '8-11', '11-15', '15-20'];

export default function ComparePage() {
  const [exams, setExams] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compareData, setCompareData] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    examsApi.list({ include_archived: true })
      .then(data => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data.results ?? []);
        setExams(list);
        setLoading(false);
      })
      .catch(e => {
        if (alive) { setError(e.message); setLoading(false); }
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (selected.size < 2) return;   // barData derives to [] below; nothing to fetch
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    setCompareLoading(true);
    examsApi.compare([...selected])
      .then(data => { if (alive) setCompareData(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setCompareData([]); })
      .finally(() => { if (alive) setCompareLoading(false); });
    return () => { alive = false; };
  }, [selected]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const filteredExams = useMemo(() => {
    if (!search) return exams;
    return exams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
  }, [exams, search]);

  const barData = (selected.size < 2 ? [] : compareData).map(e => ({
    label: e.exam_title?.length > 20 ? e.exam_title.slice(0, 18) + '…' : e.exam_title,
    value: e.avg_score != null ? Math.round(e.avg_score * 10) / 10 : 0,
  }));

  return (
    <div>
      <PageHead
        breadcrumb={['Comparativa']}
        title="Comparativa de exámenes"
        subtitle={`${selected.size} exámenes seleccionados`}
      />

      <div className="p-6 space-y-6">
        <Card title="Seleccionar exámenes" subtitle="Selecciona hasta 4 exámenes para comparar">
          <div className="flex items-center gap-3 mb-4">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar exámenes..."
              className="flex-1"
            />
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} height="80px" />)}
            </div>
          ) : error ? (
            <div className="text-center py-6 text-fg-3 text-sm">{error}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {filteredExams.map(exam => {
                const isSelected = selected.has(exam.id);
                return (
                  <button
                    key={exam.id}
                    onClick={() => toggleSelect(exam.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10'
                        : 'border-line hover:border-fg-3'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-fg-0 truncate">{exam.title}</span>
                      {isSelected && <Icon name="check" size={14} className="text-accent" />}
                    </div>
                    <div className="text-2xs text-fg-2">{exam.attempts_count ?? 0} intentos</div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {selected.size < 2 ? (
          <Card padding="lg">
            <div className="text-center py-12">
              <Icon name="trend" size={48} variant="soft" className="mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">Selecciona exámenes</h3>
              <p className="text-sm text-fg-2">Elige al menos 2 exámenes para comparar</p>
            </div>
          </Card>
        ) : compareLoading ? (
          <Card padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          </Card>
        ) : compareData.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-12">
              <Icon name="trend" size={48} variant="soft" className="mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">Sin datos</h3>
              <p className="text-sm text-fg-2">Los exámenes seleccionados no tienen intentos completados</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {compareData.map(exam => (
                <Card key={exam.exam_id} padding="md">
                  <div className="text-sm font-medium text-fg-0 mb-3 truncate">{exam.exam_title}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-fg-2">Promedio</span>
                      <span className={`text-sm font-bold ${isPassing(exam.avg_score) ? 'text-ok' : 'text-danger'}`}>
                        {exam.avg_score != null ? `${exam.avg_score.toFixed(1)}/20` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-fg-2">Aprobación</span>
                      <span className="text-sm font-bold text-fg-0">{exam.pass_rate != null ? `${Math.round(exam.pass_rate)}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-fg-2">Intentos</span>
                      <span className="text-sm font-bold text-fg-0">{exam.attempt_count ?? 0}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card title="Promedio por examen" subtitle="Comparación de puntajes promedio (vigesimal 0–20)">
              <BarChart data={barData} threshold={PASS_THRESHOLD} maxValue={20} />
            </Card>

            <Card title="Distribución de notas" subtitle="Cómo se distribuyen los puntajes">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {compareData.map(exam => (
                  <div key={exam.exam_id}>
                    <div className="text-sm font-medium text-fg-0 mb-3">{exam.exam_title}</div>
                    <div className="flex items-end gap-2 h-32">
                      {(exam.distribution || []).map((bucket, i) => {
                        const maxCount = Math.max(...(exam.distribution || []).map(b => b.count), 1);
                        const height = (bucket.count / maxCount) * 100;
                        const colors = ['bg-danger', 'bg-danger', 'bg-warn', 'bg-ok', 'bg-ok'];
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-2xs text-fg-2">{bucket.count}</span>
                            <div
                              className={`w-full rounded-t ${colors[i] ?? 'bg-fg-3'} transition-all duration-300`}
                              style={{ height: `${height}%`, minHeight: bucket.count > 0 ? '4px' : '0' }}
                            />
                            <span className="text-2xs text-fg-3">{bucket.range || DISTRIBUTION_LABELS[i]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Tabla comparativa" padding="none">
              <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Métrica</th>
                    {compareData.map(e => (
                      <th key={e.exam_id} className="text-center text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">
                        {e.exam_title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line/40">
                    <td className="px-4 py-3 text-sm text-fg-1">Intentos totales</td>
                    {compareData.map(e => (
                      <td key={e.exam_id} className="px-4 py-3 text-center text-sm font-medium text-fg-0">{e.attempt_count ?? 0}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-line/40">
                    <td className="px-4 py-3 text-sm text-fg-1">Promedio</td>
                    {compareData.map(e => (
                      <td key={e.exam_id} className={`px-4 py-3 text-center text-sm font-bold ${isPassing(e.avg_score) ? 'text-ok' : 'text-danger'}`}>
                        {e.avg_score != null ? `${e.avg_score.toFixed(1)}/20` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-line/40">
                    <td className="px-4 py-3 text-sm text-fg-1">Tasa de aprobación</td>
                    {compareData.map(e => (
                      <td key={e.exam_id} className="px-4 py-3 text-center text-sm font-medium text-fg-0">
                        {e.pass_rate != null ? `${Math.round(e.pass_rate)}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-fg-1">Mejor rango</td>
                    {compareData.map(e => {
                      const dist = e.distribution || [];
                      if (!dist.length) return <td key={e.exam_id} className="px-4 py-3 text-center text-sm text-fg-0">—</td>;
                      const maxCount = Math.max(...dist.map(b => b.count));
                      const bestIdx = dist.findIndex(b => b.count === maxCount);
                      return (
                        <td key={e.exam_id} className="px-4 py-3 text-center text-sm text-fg-0">
                          {dist[bestIdx]?.range || DISTRIBUTION_LABELS[bestIdx] || '—'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table></div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}