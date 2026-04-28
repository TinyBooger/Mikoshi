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
        {!atStart && (
          <TextButton
            disabled={loading}
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </TextButton>
        )}
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6A6286', letterSpacing: '0.5px', minWidth: 70, textAlign: 'center' }}>
          第 {page} 页
        </span>
        {!atEnd && (
          <TextButton
            disabled={loading}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </TextButton>
        )}
      </div>
      <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '0.6rem', letterSpacing: '0.4px' }}>
        {(!loading && total > 0) && (
          <span>共 {total} 条，显示第 {startIdx} - {endIdx} 条</span>
        )}
      </div>
    </div>
  );
}

export default PaginationBar;
