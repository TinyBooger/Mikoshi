import React, { useEffect, useState } from 'react';
import Table from '../components/Table';

export default function TagsPage() {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    fetch('/api/tags')
      .then(res => res.json())
      .then(data => setTags(data));
  }, []);

  const columns = ['id', 'name', 'count'];

  return (
    <div>
      <h2>Tags</h2>
      <Table columns={columns} data={tags} />
    </div>
  );
}
