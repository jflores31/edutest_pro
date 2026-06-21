import { useNavigate } from 'react-router-dom';
import { Avatar, Icon } from '../../design-system';
import { STATUS_COLORS, AVATAR_COLORS, getAttemptVariant, formatDuration, formatRelative } from '../../utils/dashboard';

export function MobileAttemptCard({ attempt: a, index: i }) {
  const navigate = useNavigate();
  const variant = getAttemptVariant(a.score);
  const sc = STATUS_COLORS[variant];
  const scorePct = a.score != null ? Math.round((a.score / 20) * 100) : 0;

  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-2/50 transition-colors text-left border-b border-line/40 last:border-0"
      onClick={() => navigate(`/teacher/attempts/${a.id}`)}
    >
      <Avatar name={a.user_name} size="sm" color={AVATAR_COLORS[i % 5]} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-medium text-fg-0 truncate">{a.user_name}</span>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
            {a.score != null ? `${a.score.toFixed(1)}/20` : a.status}
          </span>
        </div>
        <div className="text-2xs text-fg-3 truncate">{a.exam}</div>
        <div className="w-full h-1 bg-bg-2 rounded-full overflow-hidden mt-1.5">
          <div className="h-full rounded-full" style={{ width: `${scorePct}%`, background: sc.bar }} />
        </div>
      </div>
      <Icon name="chevron-right" size={14} className="text-fg-3 shrink-0" />
    </button>
  );
}

export function AttemptRow({ attempt: a, index: i, onNavigate }) {
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
      onClick={() => onNavigate(a.id)}
      onKeyDown={e => e.key === 'Enter' && onNavigate(a.id)}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={a.user_name} size="sm" color={AVATAR_COLORS[i % 5]} />
          <div>
            <div className="text-sm font-medium text-fg-0">{a.user_name}</div>
            <div className="text-2xs text-fg-3">{a.user_email}</div>
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
}
