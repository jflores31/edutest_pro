/**
 * Avatar.jsx — Círculo con iniciales o imagen
 * @param {string} src - URL de imagen
 * @param {string} name - Nombre para extraer iniciales
 * @param {'sm'|'md'|'lg'} size
 * @param {string} color - Color de fondo personalizado (clases Tailwind)
 */
export default function Avatar({
  src,
  name = '',
  size = 'md',
  color,
  className = '',
  ...props
}) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const bgColor = color || 'bg-accent-soft text-accent';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ${className}`}
        {...props}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full grid place-items-center font-semibold ${bgColor} ${className}`}
      {...props}
    >
      {initials || '?'}
    </div>
  );
}
