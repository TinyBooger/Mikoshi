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
  const currentCharDisplay = document.getElementById("current-character-display");
  const urlParams = new URLSearchParams(window.location.search);
  const loginModal = document.getElementById("login-modal");
  const selectedCharacter = urlParams.get("character");
  if (selectedCharacter) {
    currentCharacter = selectedCharacter;
    currentCharDisplay.textContent = `Chatting as: ${currentCharacter}`;
  }

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
          currentCharDisplay.textContent = `Chatting as: ${currentCharacter}`;
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
    const lines = sample.split("\n").filter(l => l.trim());
    const messages = [];
    for (const line of lines) {
      if (line.startsWith("<user>:")) {
        messages.push({ role: "user", content: line.replace("<user>:", "").trim() });
      } else if (line.startsWith("<bot>:")) {
        messages.push({ role: "assistant", content: line.replace("<bot>:", "").trim() });
      }
    }

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
            currentCharDisplay.textContent = `Chatting as: ${currentCharacter}`;
          });
          characterList.appendChild(li);
        });
      });

    characterModal.classList.add("hidden");
    characterForm.reset();
  });

  
  document.getElementById("open-login-btn").addEventListener("click", () => {
    loginModal.classList.remove("hidden");
  });

  document.getElementById("close-login-modal").addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  document.getElementById("submit-login").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) loginModal.classList.add("hidden");
  });

  document.getElementById("submit-signup").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const phone = document.getElementById("login-phone").value.trim();
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, phone })
    });
    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) loginModal.classList.add("hidden");
  });
});
