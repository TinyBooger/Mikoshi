import React, { useEffect, useState } from 'react';
import Table from '../components/Table';

export default function SearchTermsPage() {
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    fetch(`${window.API_BASE_URL}/api/search-terms`)
      .then(res => res.json())
      .then(data => setTerms(data));
  }, []);

  const columns = ['keyword', 'search_count', 'last_searched'];

  return (
    <div>
      <h2>Search Terms</h2>
      <Table columns={columns} data={terms} />
    </div>
  );
}
