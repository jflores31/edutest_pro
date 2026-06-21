/**
 * Tabs.jsx — Navegación por pestañas Material Design 3
 * @param {Array<{key: string, label: string, icon?: React.ReactNode}>} tabs
 * @param {string} activeKey
 * @param {function} onChange
 * @param {'horizontal'|'vertical'} orientation
 */
export default function Tabs({
  tabs = [],
  activeKey,
  onChange,
  orientation = 'horizontal',
  className = '',
  ...props
}) {
  const isVertical = orientation === 'vertical';

  return (
    <nav
      className={`${isVertical ? 'flex flex-col' : 'flex'} ${isVertical ? 'bg-bg-1 border border-line rounded-2xl p-1.5 h-max' : 'border-b border-line'} ${className}`}
      role="tablist"
      {...props}
    >
      {tabs.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeKey === tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            flex items-center gap-2 transition-all duration-150
            ${isVertical
              ? `w-full px-3 py-2.5 mb-0.5 rounded-xl text-sm text-left ${activeKey === tab.key ? 'bg-accent-soft text-accent font-medium' : 'text-fg-1 hover:bg-bg-2'}`
              : `px-4 py-2.5 text-sm border-b-2 ${activeKey === tab.key ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2 hover:text-fg-0 hover:border-line'}`
            }
          `}
        >
          {tab.icon && <span className="shrink-0 [&>svg]:align-middle">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
