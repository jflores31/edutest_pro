/**
 * Table.jsx — Tabla Material Design 3
 * @param {Array<{key: string, label: string, width?: string, align?: string}>} columns
 * @param {Array<object>} data
 * @param {function} onRowClick
 * @param {boolean} striped
 */
export default function Table({
  columns = [],
  data = [],
  onRowClick,
  striped = false,
  className = '',
  ...props
}) {
  return (
    <div className={`overflow-x-auto rounded-2xl ${className}`} {...props}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5"
                style={{ width: col.width, textAlign: col.align || 'left' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={`
                border-b border-line/40 last:border-0
                ${onRowClick ? 'cursor-pointer' : ''}
                ${striped && i % 2 ? 'bg-bg-2/40' : ''}
                hover:bg-bg-2/60 transition-colors
              `}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className="px-5 py-3.5 text-sm"
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="text-center py-12 text-fg-3 text-sm">
          No hay datos para mostrar
        </div>
      )}
    </div>
  );
}
