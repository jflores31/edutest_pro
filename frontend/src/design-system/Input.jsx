/**
 * Input.jsx — Campo de entrada Material Design 3
 * @param {string} label - Label del campo
 * @param {string} helper - Texto de ayuda
 * @param {string} error - Mensaje de error
 * @param {boolean} mono - Fuente monoespaciada
 * @param {string} type - Tipo de input
 */
import { useId } from 'react';

export default function Input({
  label,
  helper,
  error,
  mono = false,
  type = 'text',
  className = '',
  ...props
}) {
  const id = useId();

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs text-fg-1 font-medium mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`w-full bg-transparent border-2 ${
          error
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-line focus:border-accent focus:ring-accent/20'
        } text-fg-0 rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 transition-all placeholder:text-fg-3 ${
          mono ? 'font-mono tracking-wider' : ''
        }`}
        {...props}
      />
      {error && <div className="text-danger text-xs mt-1.5 flex items-center gap-1">{error}</div>}
      {!error && helper && <div className="text-fg-3 text-xs mt-1.5">{helper}</div>}
    </div>
  );
}
