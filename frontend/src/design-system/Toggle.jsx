/**
 * Toggle.jsx — Switch Material Design 3
 * @param {boolean} checked
 * @param {function} onChange
 * @param {string} label
 * @param {boolean} disabled
 */
export default function Toggle({
  checked = false,
  onChange,
  label,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <label className={`inline-flex items-center gap-2.5 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative w-[52px] h-[28px] rounded-full transition-colors duration-200 border-2 ${
          checked
            ? 'bg-accent border-accent'
            : 'bg-bg-3 border-line'
        }`}
        {...props}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[24px]' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-sm text-fg-1">{label}</span>}
    </label>
  );
}
