import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';

export default function SearchTermsPage() {
  const [terms, setTerms] = useState([]);
  const { sessionToken } = useContext(AuthContext);

  const fetchTerms = () => {
    fetch(`${window.API_BASE_URL}/api/admin/search-terms`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => setTerms(data))
      .catch(err => console.error('Error fetching search terms:', err));
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Search Terms</h2>
      </div>
      <Table 
        columns={columns} 
        data={terms}
        onEdit={null}
        onDelete={handleDelete}
      />
    </div>
  );
}
