import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../../design-system';
import { notifications as notificationsApi } from '../../services/api';

const LAST_SEEN_KEY = 'notifications_last_seen';

const TYPE_ICON = {
  attempt_finished: 'check',
  low_score: 'trend',
  proctoring_alert: 'eye',
  daily_summary: 'chart',
  system: 'bell',
};

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const wrapperRef = useRef(null);
  const [lastSeen, setLastSeen] = useState(
    () => localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString()
  );

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      /* notifications are non-critical; ignore fetch errors */
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = items.filter(n => n.created_at > lastSeen).length;

  function handleOpen() {
    if (!open) {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SEEN_KEY, now);
      setLastSeen(now);
    }
    setOpen(v => !v);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={handleOpen}
        className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg-2 hover:bg-bg-2 hover:text-fg-0 transition-colors"
        aria-label="Notificaciones"
      >
        <Icon name="bell" size={16} strokeWidth={1.8} />
        <span>Notificaciones</span>
        {unread > 0 && (
          <span className="absolute left-6 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full bottom-0 ml-2 w-80 bg-bg-1 border border-line rounded-2xl shadow-pop z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-semibold text-fg-0">Notificaciones</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-fg-3 hover:bg-bg-2 hover:text-fg-0 transition-colors"
            >
              <Icon name="x" size={14} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-fg-3">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="bell" size={32} className="text-fg-3 mx-auto mb-2" />
                <p className="text-sm text-fg-2">Sin notificaciones</p>
              </div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-line/40 last:border-0 hover:bg-bg-2 transition-colors"
                >
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-accent/10">
                    <Icon name={TYPE_ICON[n.type] || 'bell'} size={13} className="text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg-0 leading-tight">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-fg-2 leading-tight">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-fg-3">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
