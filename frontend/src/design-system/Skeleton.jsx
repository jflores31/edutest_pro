/**
 * Skeleton.jsx — Loader con shimmer animation
 * @param {'text'|'circle'|'rect'} variant
 * @param {string} width
 * @param {string} height
 * @param {boolean} animate
 */
export default function Skeleton({
  variant = 'text',
  width,
  height,
  animate = true,
  className = '',
  ...props
}) {
  const variants = {
    text: 'rounded h-4',
    circle: 'rounded-full',
    rect: 'rounded-xl',
  };

  const style = {
    width: width || (variant === 'circle' ? height : '100%'),
    height: height || (variant === 'text' ? '1rem' : undefined),
  };

  return (
    <div
      className={`bg-bg-2/70 ${variants[variant]} ${animate ? 'animate-pulse' : ''} ${className}`}
      style={style}
      {...props}
    />
  );
}

/**
 * SkeletonGroup — Grupo de skeletons predefinidos
 */
export function SkeletonKPI() {
  return (
    <div className="bg-bg-1 shadow-card rounded-2xl p-5 space-y-3">
      <Skeleton width="60%" height="12px" />
      <Skeleton width="40%" height="28px" />
      <Skeleton width="80%" height="10px" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-bg-1 shadow-card rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-line">
        <Skeleton width="30%" height="16px" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-line/40 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} width={`${100 / cols}%`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}
