let currentCharacterId = null;
let currentCharacterName = null;

async function loadCharacterDetails(characterId) {
  try {
    const res = await fetch(`/api/character/${characterId}`);
    if (!res.ok) throw new Error();

    const char = await res.json();

    // Fill in sidebar details
    document.getElementById("char-pic").src = char.picture || "/static/default.png";
    document.getElementById("char-name").textContent = char.name;
    document.getElementById("char-views").textContent = char.views || 0;
    document.getElementById("char-likes").textContent = char.likes || 0;
    document.getElementById("char-created").textContent = new Date(char.created_time).toLocaleDateString();

    // Fetch creator info
    const userRes = await fetch(`/api/user/${char.creator_id}`);
    if (userRes.ok) {
      const creator = await userRes.json();
      document.getElementById("char-creator").textContent = creator.name || "Unknown";
    } else {
      document.getElementById("char-creator").textContent = "Unknown";
    }
    document.getElementById("char-creator").href = `/profile/${char.creator_id}`;

    // Like button
    document.getElementById("like-button").onclick = async () => {
      const res = await fetch(`/api/character/${characterId}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        document.getElementById("char-likes").textContent = data.likes;
      }
    };
  } catch {
    console.error("Failed to load character details.");
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  const chatForm = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const chatBox = document.getElementById("chat-box");
  const currentCharDisplay = document.getElementById("current-character-display");

  const urlParams = new URLSearchParams(window.location.search);
  currentCharacterId = urlParams.get("character");

  if (currentCharacterId) {
    loadCharacterDetails(currentCharacterId);

    try {
      const res = await fetch(`/api/character/${currentCharacterId}`);
      if (res.ok) {
        const char = await res.json();
        currentCharacterName = char.name;
        currentCharDisplay.textContent = `Chatting as: ${currentCharacterName}`;
      } else {
        currentCharDisplay.textContent = "Chatting as: Unknown";
      }
    } catch {
      currentCharDisplay.textContent = "Chatting as: Unknown";
    }

    // Update recent usage
    fetch("/api/recent-characters/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: currentCharacterId }),
    });

    // Update views
    fetch("/api/views/increment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: currentCharacterId})
    });

    loadRecentCharacters();
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message || !currentCharacterId) return;

    appendMessage("User", message);
    inputEl.value = "";

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character_id: currentCharacterId,
        message: message
      })
    });

    const data = await res.json();
    appendMessage(currentCharacterName || "Character", data.response);
  });

  function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
