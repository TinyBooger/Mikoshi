import React from 'react';
import TextButton from './TextButton';

/**
 * PaginationBar - reusable pagination control.
 * Props:
 *  page: current page (1-indexed)
 *  total: total number of items
 *  pageSize: items per page
 *  loading: boolean for disabled state
 *  onPageChange: function(newPage)
 *  style: optional style overrides
 */
function PaginationBar({ page, total, pageSize, loading, onPageChange, style = {} }) {
  const atStart = page <= 1;
  const atEnd = page * pageSize >= total;
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '1.5rem',
      paddingBottom: '2.5rem',
      ...style
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <TextButton
          disabled={loading || atStart}
          onClick={() => {
            if (!atStart) onPageChange(page - 1);
          }}
        >
          Prev
        </TextButton>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6A6286', letterSpacing: '0.5px', minWidth: 70, textAlign: 'center' }}>
          Page {page}
        </span>
        <TextButton
          disabled={loading || atEnd}
          onClick={() => {
            if (!atEnd) onPageChange(page + 1);
          }}
        >
          Next
        </TextButton>
      </div>
      <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '0.6rem', letterSpacing: '0.4px' }}>
        {(!loading && total > 0) && (
          <span>Showing {startIdx} - {endIdx} of {total}</span>
        )}
      </div>
    </div>
  );
}

export default PaginationBar;
