async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  alert(data.message || data.detail);
  if (res.ok) {
    document.getElementById("login-modal").classList.add("hidden");
    await checkLogin();
  }
}

function handleSignupRedirect() {
  window.location.href = "/static/account_setup.html";
}

function loadCharacters() {
  fetch("/api/characters")
    .then(res => res.json())
    .then(data => {
      const characterList = document.getElementById("character-list");
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
}

async function checkLogin() {
  const res = await fetch("/api/current-user");
  if (res.ok) {
    const user = await res.json();
    if (user.name) showUserMenu(user);
  }
}

function showUserMenu(user) {
  const authDiv = document.getElementById("auth-controls");
  document.getElementById("open-login-btn").style.display = "none";

  const userMenu = document.getElementById("user-menu");
  const userPic = document.getElementById("user-pic");
  const userName = document.getElementById("user-name");
  const dropdown = document.getElementById("dropdown");
  const toggle = document.getElementById("menu-toggle");

  userPic.src = user.profile_pic || "/static/default-avatar.png";
  userName.textContent = user.name;
  userMenu.style.display = "flex";

  toggle.addEventListener("click", () => {
    dropdown.style.display = dropdown.style.display === "none" ? "flex" : "none";
    toggle.textContent = dropdown.style.display === "none" ? "▾" : "▴";
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  });
}


function initSidebar() {
  const loginModal = document.getElementById("login-modal");
  const characterList = document.getElementById("character-list");
  const createCharBtn = document.getElementById("create-character-btn");
  const characterModal = document.getElementById("character-modal");
  const closeModalBtn = document.getElementById("close-modal");
  const characterForm = document.getElementById("character-form");

  createCharBtn.addEventListener("click", () => {
    characterModal.classList.remove("hidden");
  });

  closeModalBtn.addEventListener("click", () => {
    characterModal.classList.add("hidden");
  });

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        persona: persona,
        sample_dialogue: sample
      })
    });

    loadCharacters();
    characterModal.classList.add("hidden");
    characterForm.reset();
  });

  const openLoginBtn = document.getElementById("open-login-btn");
  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", () => {
      loginModal.classList.remove("hidden");
    });
  }

  const closeLoginBtn = document.getElementById("close-login-modal");
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", () => {
      loginModal.classList.add("hidden");
    });
  }

  const submitLogin = document.getElementById("submit-login");
  if (submitLogin) {
    submitLogin.addEventListener("click", handleLogin);
  }

  const submitSignup = document.getElementById("submit-signup");
  if (submitSignup) {
    submitSignup.addEventListener("click", handleSignupRedirect);
  }

  checkLogin();
}
