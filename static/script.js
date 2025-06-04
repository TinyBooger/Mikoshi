let currentCharacter = null;

document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const chatBox = document.getElementById("chat-box");
  const characterList = document.getElementById("character-list");
  const createCharBtn = document.getElementById("create-character-btn");
  const characterModal = document.getElementById("character-modal");
  const closeModalBtn = document.getElementById("close-modal");
  const characterForm = document.getElementById("character-form");

  // Load characters
  fetch("/api/characters")
    .then(res => res.json())
    .then(data => {
      characterList.innerHTML = "";
      Object.keys(data).forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;
        li.addEventListener("click", () => {
          currentCharacter = name;
          chatBox.innerHTML = "";
        });
        characterList.appendChild(li);
      });
    });

  // Handle chat form submission
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message || !currentCharacter) return;
    appendMessage("User", message);
    inputEl.value = "";

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        character: currentCharacter,
        message: message
      })
    });

    const data = await response.json();
    appendMessage(currentCharacter, data.response);
  });

  // Append message to chat box
  function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // Show character creation modal
  createCharBtn.addEventListener("click", () => {
    characterModal.classList.remove("hidden");
  });

  // Close modal
  closeModalBtn.addEventListener("click", () => {
    characterModal.classList.add("hidden");
  });

  // Handle character creation form
  characterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("char-name").value.trim();
    const persona = document.getElementById("char-persona").value.trim();
    const sample = document.getElementById("char-sample").value.trim();

    if (!name || !persona) return;

    await fetch("/api/create-character", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        persona: persona,
        sample_dialogue: sample
      })
    });

    // Reload character list
    fetch("/api/characters")
      .then(res => res.json())
      .then(data => {
        characterList.innerHTML = "";
        Object.keys(data).forEach(name => {
          const li = document.createElement("li");
          li.textContent = name;
          li.addEventListener("click", () => {
            currentCharacter = name;
            chatBox.innerHTML = "";
          });
          characterList.appendChild(li);
        });
      });

    characterModal.classList.add("hidden");
    characterForm.reset();
  });
});
