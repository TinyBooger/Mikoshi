let currentCharacter = null;

document.addEventListener("DOMContentLoaded", () => {
  // Insert sidebar HTML first
  fetch("/static/sidebar.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("sidebar-placeholder").innerHTML = html;

      // Now load sidebar.js
      const sidebarScript = document.createElement("script");
      sidebarScript.src = "/static/sidebar.js";
      document.body.appendChild(sidebarScript);
    });

  const chatForm = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const chatBox = document.getElementById("chat-box");
  const characterList = document.getElementById("character-list");
  const currentCharDisplay = document.getElementById("current-character-display");
  const urlParams = new URLSearchParams(window.location.search);
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

  // Dynamically load sidebar.js after sidebar is fetched
  const waitForSidebar = setInterval(() => {
    if (document.getElementById("create-character-btn")) {
      clearInterval(waitForSidebar);
      const sidebarScript = document.createElement("script");
      sidebarScript.src = "/static/sidebar.js";
      document.body.appendChild(sidebarScript);
    }
  }, 50);
});
