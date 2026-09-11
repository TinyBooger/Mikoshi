import React from "react";

/**
 * Lightweight admin table.
 *
 * `columns` accepts either plain strings (backwards compatible) or objects:
 *   { key, label, sortable, align }
 *
 * When `onSort` is provided, columns flagged `sortable` render clickable
 * headers with a direction indicator driven by the `sort` prop
 * (`{ key, dir: 'asc' | 'desc' }`).
 */
export default function Table({
  columns,
  data,
  onEdit,
  onDelete,
  customActions = [],
  actions = true,
  sort,
  onSort,
  emptyMessage = "No data",
}) {
  const cols = columns.map((col) => (typeof col === "string" ? { key: col, label: col } : col));

  const renderSortIcon = (key) => {
    if (sort?.key !== key) return "bi-arrow-down-up";
    return sort.dir === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill";
  };

  return (
    <table className="table table-striped table-hover mb-0">
      <thead className="table-dark">
        <tr>
          {cols.map((col) => (
            <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
              {col.sortable && onSort ? (
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  title="Click to sort"
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    padding: 0,
                    font: "inherit",
                    fontWeight: "inherit",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {col.label}
                  <i className={`bi ${renderSortIcon(col.key)}`} style={{ fontSize: "0.7rem", opacity: 0.85 }} />
                </button>
              ) : (
                col.label
              )}
            </th>
          ))}
          {actions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td colSpan={cols.length + (actions ? 1 : 0)} className="text-center py-4 text-muted">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {cols.map((col) => (
                <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                  {typeof row[col.key] === 'boolean'
                    ? (row[col.key] ? '✓' : '✗')
                    : Array.isArray(row[col.key])
                      ? row[col.key].join(', ')
                      : typeof row[col.key] === 'object' && row[col.key]?.$$typeof
                        ? row[col.key]
                        : String(row[col.key] ?? '')}
                </td>
              ))}
              {actions && (
                <td>
                  <div className="btn-group btn-group-sm" role="group">
                    {onEdit && (
                      <button
                        className="btn btn-outline-primary"
                        onClick={() => onEdit(row)}
                        title="Edit"
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => onDelete(row)}
                        title="Delete"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                    {customActions.map((action, idx) => (
                      <button
                        key={idx}
                        className={`btn ${action.className || 'btn-outline-secondary'}`}
                        onClick={() => action.onClick(row)}
                        title={action.label}
                      >
                        {action.icon && <i className={`bi ${action.icon}`}></i>}
                        {action.text && <span className="ms-1">{action.text}</span>}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
