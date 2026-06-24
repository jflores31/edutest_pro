import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Icon } from '../../design-system';

export function EmptyBanner() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-4 bg-accent-soft border border-accent/15 rounded-xl px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <Icon name="chart" size={18} variant="chip" strokeWidth={1.9} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-0">Aún no hay intentos completados</p>
          <p className="text-xs text-fg-2 truncate">Comparte el link del examen con tus alumnos para ver estadísticas.</p>
        </div>
      </div>
      <button onClick={() => navigate('/teacher/exams')} className="shrink-0">
        <span className="text-sm font-medium text-accent hover:underline">Ir a exámenes →</span>
      </button>
    </div>
  );
}

export function QuickActions({ stats, liveData }) {
  const actions = useMemo(() => {
    // 'Importar' ya está en el menú lateral; no se duplica en Acceso rápido.
    const base = [
      { icon: 'plus', label: 'Nuevo examen', to: '/teacher/exams/new' },
    ];
    if ((liveData?.proctoring_alerts_24h ?? 0) > 0) {
      base.push({ icon: 'alert', label: `${liveData.proctoring_alerts_24h} alertas`, to: '/teacher/monitoring', urgent: true });
    } else if ((stats?.exams_draft_count ?? 0) > 0) {
      base.push({ icon: 'edit', label: `${stats.exams_draft_count} borradores`, to: '/teacher/exams?filter=draft' });
    } else {
      base.push({ icon: 'chart', label: 'Comparar exámenes', to: '/teacher/compare' });
    }
    base.push({ icon: 'users', label: 'Ver estudiantes', to: '/teacher/students' });
    return base;
  }, [stats, liveData]);

  return (
    <Card title="Acceso rápido" padding="sm" variant="outlined">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => (
          <Link
            key={a.label}
            to={a.to}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-bg-2/60 transition-colors text-sm
              ${a.urgent ? 'text-warn hover:bg-warn-soft' : 'text-fg-1 hover:bg-accent-soft hover:text-accent'}`}
          >
            <Icon name={a.icon} size={15} strokeWidth={1.9} variant={a.urgent ? 'plain' : 'soft'} />
            {a.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
