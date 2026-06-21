import { Button, Icon } from '../../design-system';

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 bg-danger-soft border border-danger/20 rounded-xl px-4 py-3">
      <Icon name="alert" size={16} className="text-danger mt-0.5 shrink-0" strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-danger">No pudimos cargar el resumen</div>
        <div className="text-xs text-fg-2 mt-0.5">{message || 'Puede ser un problema temporal de conexión.'}</div>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="shrink-0">
          Reintentar
        </Button>
      )}
    </div>
  );
}
