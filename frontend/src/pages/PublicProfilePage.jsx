// src/pages/PublicProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router';
import CharacterCard from "../components/CharacterCard";

export default function PublicProfilePage() {
  const [user, setUser] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const userId = pathParts[pathParts.length - 1];
    if (!userId) {
      alert("Invalid user ID.");
      return;
    }

    async function fetchData() {
      const resUser = await fetch(`/api/user/${userId}`);
      if (!resUser.ok) {
        alert("User not found.");
        setLoading(false);
        return;
      }
      const userData = await resUser.json();
      setUser(userData);

      const resChars = await fetch(`/api/characters-created?user_id=${userId}`);
      if (resChars.ok) {
        const charsData = await resChars.json();
        setCharacters(charsData);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found.</div>;

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <main className="flex-grow-1 p-4">
          <section className="mb-4 d-flex align-items-center gap-3">
            <img
              src={user.profile_pic || "/static/default-avatar.png"}
              alt="Profile Picture"
              className="rounded-circle"
              style={{ width: 100, height: 100 }}
            />
            <h2 className="mb-0">{user.name || "Unknown"}</h2>
          </section>

          <section>
            <h3 className="mb-3">Characters</h3>
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
              {characters.length > 0 ? (
                characters.map((c) => <CharacterCard  character={c} />)
              ) : (
                <p>No characters found.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
