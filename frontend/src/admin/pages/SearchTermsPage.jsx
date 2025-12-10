import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import PaginationBar from '../../components/PaginationBar';

export default function SearchTermsPage() {
  const [terms, setTerms] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;
  const { sessionToken } = useContext(AuthContext);

  const fetchTerms = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/search-terms`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => {
        setTerms(data);
        setTotal(data.length);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching search terms:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTerms();
  }, [sessionToken]);

  const handleDelete = async (term) => {
    if (!confirm(`Are you sure you want to delete search term "${term.keyword}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/search-terms/${encodeURIComponent(term.keyword)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('Search term deleted successfully');
        fetchTerms();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to delete search term'}`);
      }
    } catch (err) {
      console.error('Error deleting search term:', err);
      alert('Failed to delete search term');
    }
  };

  const columns = ['keyword', 'search_count', 'last_searched'];

  // Paginate terms
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedTerms = terms.slice(startIdx, endIdx);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Search Terms</h2>
        <span className="text-muted">Total: {total} search terms</span>
      </div>
      
      <div className="table-responsive">
        <Table 
          columns={columns} 
          data={paginatedTerms}
          onEdit={null}
          onDelete={handleDelete}
        />
      </div>

      <PaginationBar
        page={page}
        total={total}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />
    </div>
  );
}
