import React from "react";

export default function Table({ columns, data, onEdit, onDelete, actions = true }) {
  return (
    <table className="table table-striped table-hover">
      <thead className="table-dark">
        <tr>
          {columns.map(col => <th key={col}>{col}</th>)}
          {actions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {columns.map(col => (
              <td key={col}>
                {typeof row[col] === 'boolean' 
                  ? (row[col] ? '✓' : '✗')
                  : Array.isArray(row[col])
                    ? row[col].join(', ')
                    : String(row[col] ?? '')}
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
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
