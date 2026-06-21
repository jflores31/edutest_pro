export { formatRelative, formatDuration } from './formatters';

export const PERIODS = [
  { key: '7d',  label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'Todo' },
];

export const STATUS_COLORS = {
  pass: { bg: 'bg-ok/10',     text: 'text-ok',     bar: 'var(--color-ok)' },
  fail: { bg: 'bg-danger/10', text: 'text-danger',  bar: 'var(--color-danger)' },
  warn: { bg: 'bg-warn/10',   text: 'text-warn',    bar: 'var(--color-warn)' },
};

export const AVATAR_COLORS = [
  'bg-accent-soft text-accent',
  'bg-ok-soft text-ok',
  'bg-warn-soft text-warn',
  'bg-danger-soft text-danger',
  'bg-bg-3 text-fg-2',
];

export function buildHeatmapMatrix(raw = []) {
  if (!raw.length) {
    return { matrix: Array.from({ length: 7 }, () => new Array(7).fill(0)), hours: ['8','10','12','14','16','18','20'] };
  }
  const uniqueHours = [...new Set(raw.map(r => r.hour))].sort((a, b) => a - b);
  const matrix = Array.from({ length: 7 }, () => new Array(uniqueHours.length).fill(0));
  const maxCount = Math.max(...raw.map(r => r.count), 1);
  raw.forEach(({ day, hour, count }) => {
    const hi = uniqueHours.indexOf(hour);
    if (day >= 0 && day < 7 && hi >= 0) {
      matrix[day][hi] = Math.min(4, Math.ceil((count / maxCount) * 4));
    }
  });
  return { matrix, hours: uniqueHours.map(String) };
}

export function buildHistogram(raw = []) {
  return raw.map(b => ({
    range: b.label,
    count: b.count,
    color: b.min >= 11 ? 'var(--color-ok)' : b.min >= 9 ? 'var(--color-warn)' : 'var(--color-danger)',
  }));
}

export function buildBarData(raw = []) {
  return raw.map(e => ({
    label: e.exam_title,
    value: e.avg_score != null ? Math.round(e.avg_score * 10) / 10 : 0,
  }));
}

export function buildDonut(total, passRate, abandonmentRate) {
  if (!total) return { pass: 0, fail: 0, abandoned: 0 };
  const pass = Math.round(total * (passRate ?? 0) / 100);
  const abandoned = Math.round(total * (abandonmentRate ?? 0) / 100);
  return { pass, fail: Math.max(0, total - pass - abandoned), abandoned };
}

export function getAttemptVariant(score) {
  if (score == null) return 'warn';
  return score >= 11 ? 'pass' : 'fail';
}