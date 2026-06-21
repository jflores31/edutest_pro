/**
 * Select.jsx — Componente de selección reutilizable
 * Mismo estilo que Input del design system.
 */

/**
 * @param {string} label
 * @param {string} value
 * @param {(e: React.ChangeEvent<HTMLSelectElement>) => void} onChange
 * @param {Array<{value: string, label: string}>} options
 * @param {string} [placeholder]
 * @param {string} [className]
 * @param {string} [helper]
 * @param {boolean} [disabled]
 */
export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  className = '',
  helper,
  disabled = false,
  children,
  ...rest
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-fg-1">{label}</label>
      )}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2 text-sm text-fg-0
          outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          appearance-none bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
        {children}
      </select>
      {helper && <p className="text-2xs text-fg-3">{helper}</p>}
    </div>
  );
}
