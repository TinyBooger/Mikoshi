let currentCharacter = null;

document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const chatBox = document.getElementById("chat-box");
  const characterList = document.getElementById("character-list");
  const currentCharDisplay = document.getElementById("current-character-display");
  const urlParams = new URLSearchParams(window.location.search);
  const selectedCharacterId = urlParams.get("character");
  let currentCharacterId = null;
  let currentCharacterName = null;
  if (selectedCharacterId) {
  currentCharacterId = selectedCharacterId;
    // Optionally fetch character name from the API to display, or store name when loading characters
  }

  // Load characters
  fetch("/api/characters")
    .then(res => res.json())
    .then(data => {
      characterList.innerHTML = "";
      // data now is an array or object with id and name, adjust accordingly
      Object.entries(data).forEach(([id, char]) => {
        const li = document.createElement("li");
        li.textContent = char.name;
        li.addEventListener("click", () => {
          currentCharacterId = id;
          currentCharacterName = char.name;
          chatBox.innerHTML = "";
          currentCharDisplay.textContent = `Chatting as: ${currentCharacterName}`;
        });
        characterList.appendChild(li);

        // If no id selected yet and this character matches id, set display
        if (currentCharacterId == id) {
          currentCharacterName = char.name;
          currentCharDisplay.textContent = `Chatting as: ${currentCharacterName}`;
        }
      });
    });

  // On form submit
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message || !currentCharacterId) return;
    appendMessage("User", message);
    inputEl.value = "";

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        character_id: currentCharacterId,
        message: message
      })
    });

    const data = await response.json();
    appendMessage(currentCharacterName || "Character", data.response);
  });

  // Append message to chat box
  function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
