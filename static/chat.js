let currentCharacterId = null;
let currentCharacterName = null;

document.addEventListener("DOMContentLoaded", async () => {
  const chatForm = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const chatBox = document.getElementById("chat-box");
  const currentCharDisplay = document.getElementById("current-character-display");

  const urlParams = new URLSearchParams(window.location.search);
  currentCharacterId = urlParams.get("character");

  if (currentCharacterId) {
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
