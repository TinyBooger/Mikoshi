import React, { useEffect, useState } from 'react';
import Table from '../components/Table';

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    fetch(`${window.API_BASE_URL}/api/characters`)
      .then(res => res.json())
      .then(data => {
        const list = Object.entries(data).map(([id, c]) => ({
          id,
          name: c.name,
          persona: c.persona.slice(0, 30) + '...',
          creator_id: c.creator_id,
          views: c.views,
          likes: c.likes
        }));
        setCharacters(list);
      });
  }, []);

  const columns = ['id', 'name', 'persona', 'creator_id', 'views', 'likes'];

  return (
    <div>
      <h2>Characters</h2>
      <Table columns={columns} data={characters} />
    </div>
  );
}
