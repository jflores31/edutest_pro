import { useNavigate } from 'react-router-dom';
import { Badge, Button } from '../../design-system';

export function LiveBanner({ data, countdown }) {
  const navigate = useNavigate();
  const count = data?.live_attempts ?? 0;
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-ok-soft border border-ok/20 rounded-xl">
      <span
        className="w-2 h-2 rounded-full bg-ok animate-pulse shrink-0"
        role="status"
        aria-label="Activo"
      />
      <span className="text-sm text-ok font-medium">
        {count} estudiante{count !== 1 ? 's' : ''} rindiendo ahora
      </span>
      {(data?.proctoring_alerts_24h ?? 0) > 0 && (
        <Badge variant="warning" dot>
          {data.proctoring_alerts_24h} alerta{data.proctoring_alerts_24h !== 1 ? 's' : ''}
        </Badge>
      )}
      <span className={`text-2xs ml-auto flex items-center gap-1.5 ${countdown < 4 ? 'text-ok' : 'text-fg-3'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${countdown < 4 ? 'bg-ok animate-pulse' : 'bg-fg-3'}`} />
        {countdown}s
      </span>
      <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/monitoring')}>
        Ver →
      </Button>
    </div>
  );
}
