import { useState, useEffect, useRef } from 'react';
import { Card, Button, Icon, Badge, Toggle } from '../../design-system';

const STATUS_MAP = {
  published: { label: 'Publicado', variant: 'success' },
  draft: { label: 'Borrador', variant: 'warning' },
  archived: { label: 'Archivado', variant: 'neutral' },
};

export default function ExamCard({ exam, onCopyLink, onEdit, onDelete, onArchive, onUnarchive, onPublish, onUnpublish, onDuplicate, onToggleChange }) {
  const [showNota, setShowNota] = useState(exam.showNota);
  const [showResp, setShowResp] = useState(exam.showResp);
  const [showExpl, setShowExpl] = useState(exam.showExpl);
  const [showMenu, setShowMenu] = useState(false);
  const [cardLoading, setCardLoading] = useState(null);
  const menuRef = useRef(null);
  const status = STATUS_MAP[exam.status] || STATUS_MAP.draft;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    setShowNota(exam.showNota);
    setShowResp(exam.showResp);
    setShowExpl(exam.showExpl);
  }, [exam.showNota, exam.showResp, exam.showExpl]);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleToggle = (field, value) => {
    const next = {
      showNota: field === 'showNota' ? value : showNota,
      showResp: field === 'showResp' ? value : showResp,
      showExpl: field === 'showExpl' ? value : showExpl,
    };
    if (field === 'showNota') setShowNota(value);
    if (field === 'showResp') setShowResp(value);
    if (field === 'showExpl') setShowExpl(value);
    onToggleChange(exam.id, {
      show_score: next.showNota,
      show_answers: next.showResp,
      show_explanations: next.showExpl,
    });
  };

  const runMenuAction = async (action, handler) => {
    setCardLoading(action);
    setShowMenu(false);
    try {
      await handler();
    } finally {
      setCardLoading(null);
    }
  };

  const hasAttempts = exam.attempts > 0;
  const cardBorder = exam.status === 'published'
    ? 'border-accent/20 shadow-sm'
    : exam.status === 'archived'
    ? 'opacity-70'
    : 'border-dashed border-line/60';

  return (
    <Card className={`group ${cardBorder}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg-0 truncate">{exam.title}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-fg-2">
            <span className="flex items-center gap-1.5">
              <Icon name="book" size={13} variant="soft" />
              {exam.questions} preguntas
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={13} variant="soft" tone="sky" />
              {exam.duration || 'Sin límite'}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="users" size={13} variant="soft" />
              {exam.maxAttempts ? `${exam.attempts}/${exam.maxAttempts} intentos` : `${exam.attempts} intentos`}
            </span>
          </div>
        </div>
        <Badge variant={status.variant} dot>{status.label}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-bg-2 rounded-xl">
        <div className="text-center">
          <div className="text-2xs text-fg-3 mb-0.5">Promedio</div>
          {hasAttempts ? (
            <div className={`text-lg font-bold tabular-nums ${exam.avg >= 55 ? 'text-ok' : 'text-danger'}`}>
              {exam.avg}%
            </div>
          ) : (
            <div className="text-sm text-fg-3">—</div>
          )}
        </div>
        <div className="text-center border-x border-line">
          <div className="text-2xs text-fg-3 mb-0.5">Aprobación</div>
          {hasAttempts ? (
            <div className={`text-lg font-bold tabular-nums ${exam.passRate >= 50 ? 'text-ok' : 'text-warn'}`}>
              {exam.passRate}%
            </div>
          ) : (
            <div className="text-sm text-fg-3">—</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-2xs text-fg-3 mb-0.5">Última actividad</div>
          <div className="text-sm font-medium text-fg-1">{exam.lastActivity}</div>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-bg-2 rounded-xl mb-4">
        <span className="text-xs text-fg-2">Mostrar al finalizar:</span>
        <div className="flex items-center gap-2">
          <Toggle checked={showNota} onChange={v => handleToggle('showNota', v)} label="Nota" />
          <Toggle checked={showResp} onChange={v => handleToggle('showResp', v)} label="Resp." />
          <Toggle checked={showExpl} onChange={v => handleToggle('showExpl', v)} label="Expl." />
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 bg-bg-2 rounded-xl mb-4">
        <Icon name="link" size={13} className="text-fg-3 shrink-0" />
        <code className="flex-1 text-xs font-mono text-fg-1 truncate">/exam/{exam.slug}</code>
        <Button variant="ghost" size="sm" onClick={() => onCopyLink(exam.slug)}>
          <Icon name="copy" size={12} />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          icon={<Icon name="edit" size={13} />}
          onClick={() => onEdit(exam)}
        >
          Editar
        </Button>
        {exam.status !== 'archived' && (
          <Button
            variant={exam.status === 'published' ? 'secondary' : 'primary'}
            size="sm"
            icon={<Icon name={exam.status === 'published' ? 'eyeoff' : 'eye'} size={13} />}
            onClick={() => runMenuAction(
              exam.status === 'published' ? 'unpublish' : 'publish',
              () => exam.status === 'published' ? onUnpublish(exam) : onPublish(exam)
            )}
            disabled={exam.status === 'draft' && exam.questions === 0}
            title={exam.status === 'published' ? 'Despublicar examen' : exam.questions === 0 ? 'Agrega preguntas para publicar' : 'Publicar examen'}
          >
            {exam.status === 'published' ? 'Despublicar' : 'Publicar'}
          </Button>
        )}
        <div className="relative" ref={menuRef}>
          <Button variant="ghost" size="sm" onClick={() => setShowMenu(!showMenu)} disabled={!!cardLoading}>
            {cardLoading
              ? <span className="w-4 h-4 border-2 border-fg-3 border-t-transparent rounded-full animate-spin inline-block" />
              : <Icon name="more" size={14} />
            }
          </Button>
          {showMenu && (
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-bg-1 border border-line rounded-xl shadow-pop z-10 py-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-1 hover:bg-bg-2 transition-colors"
                onClick={() => runMenuAction('duplicate', () => onDuplicate(exam))}
              >
                <Icon name="copy" size={14} /> Duplicar
              </button>
              {exam.status === 'archived' ? (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-1 hover:bg-bg-2 transition-colors"
                  onClick={() => runMenuAction('unarchive', () => onUnarchive(exam))}
                >
                  <Icon name="refresh" size={14} /> Desarchivar
                </button>
              ) : (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-1 hover:bg-bg-2 transition-colors"
                  onClick={() => runMenuAction('archive', () => onArchive(exam))}
                >
                  <Icon name="archive" size={14} /> Archivar
                </button>
              )}
              <div className="border-t border-line my-1" />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                onClick={() => { onDelete(exam); setShowMenu(false); }}
              >
                <Icon name="trash" size={14} /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}