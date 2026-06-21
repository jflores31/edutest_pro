import { Button, Icon } from '../../design-system';

export default function ConfirmModal({ state, onClose, onConfirm }) {
  const { draftRows, validationErrors, phase } = state;

  const totalRows = draftRows.length;
  const errorRows = draftRows.filter(r => r._errors.length > 0).length;
  const dirtyRows = draftRows.filter(r => r._isDirty && !r._isNew).length;
  const newRows = draftRows.filter(r => r._isNew).length;
  const validRows = totalRows - errorRows;
  const confirming = phase === 'confirming';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-1 border border-line rounded-2xl shadow-pop w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg-0">Confirmar importación</h2>
          <button onClick={onClose} className="text-fg-3 hover:text-fg-0 transition-colors">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-2 text-sm text-fg-1">
            <Icon name="check" size={15} className="text-ok shrink-0" />
            <span><strong>{validRows}</strong> pregunta{validRows !== 1 ? 's' : ''} serán importadas</span>
          </div>
          {dirtyRows > 0 && (
            <div className="flex items-center gap-2 text-sm text-fg-1">
              <span className="text-accent shrink-0 w-[15px] text-center">✎</span>
              <span><strong>{dirtyRows}</strong> pregunta{dirtyRows !== 1 ? 's' : ''} editadas manualmente</span>
            </div>
          )}
          {newRows > 0 && (
            <div className="flex items-center gap-2 text-sm text-fg-1">
              <span className="text-ok shrink-0 w-[15px] text-center">+</span>
              <span><strong>{newRows}</strong> pregunta{newRows !== 1 ? 's' : ''} agregadas</span>
            </div>
          )}
          {errorRows > 0 && (
            <div className="flex items-center gap-2 text-sm text-warn">
              <Icon name="info" size={15} className="shrink-0" />
              <span><strong>{errorRows}</strong> pregunta{errorRows !== 1 ? 's' : ''} con errores serán omitidas</span>
            </div>
          )}
        </div>

        {errorRows > 0 && (
          <div className="mb-5 p-3 bg-warn/5 border border-warn/20 rounded-xl text-xs text-fg-2">
            Las preguntas con errores no se importarán. Puedes cerrar y corregirlas antes de confirmar.
          </div>
        )}

        {validationErrors && validationErrors.length > 0 && (
          <div className="mb-5 p-3 bg-danger/5 border border-danger/20 rounded-xl max-h-32 overflow-y-auto">
            {validationErrors.map((e, i) => (
              <div key={i} className="text-xs text-danger py-0.5">
                <span className="font-medium">{e.field}:</span> {e.message}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={confirming}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={validRows === 0 || confirming}
            icon={confirming
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              : <Icon name="check" size={14} />
            }
          >
            {confirming ? 'Importando...' : `Importar ${validRows} pregunta${validRows !== 1 ? 's' : ''} →`}
          </Button>
        </div>
      </div>
    </div>
  );
}
