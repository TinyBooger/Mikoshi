//static/sidebar.js
let isLoggedIn = false;

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
    document.getElementById("open-login-btn").classList.add("d-none");
    await checkLogin();
  }
}

function handleSignupRedirect() {
  window.location.href = "/static/account_setup.html";
}

async function loadRecentCharacters() {
  try {
    const res = await fetch("/api/recent-characters");
    if (!res.ok) throw new Error("Failed to load recent characters");
    const recentChars = await res.json();

    const sidebar = document.getElementById("recent-characters");
    sidebar.innerHTML = "";

    if (recentChars.length === 0) {
      sidebar.textContent = "No recent chats";
      return;
    }

    recentChars.forEach(c => {
      const div = document.createElement("div");
      div.className = "recent-character";
      div.style.cursor = "pointer";
      div.onclick = () => window.location.href = `/chat?character=${c.id}`;
      div.innerHTML = `
        <img src="${c.picture || '/static/default.png'}" alt="${c.name}" style="width:30px; height:30px; border-radius:50%; margin-right:8px;">
        <span>${c.name}</span>
      `;
      sidebar.appendChild(div);
    });
  } catch (e) {
    console.error(e);
  }
}

async function checkLogin() {
  const res = await fetch("/api/current-user");
  if (res.ok) {
    const user = await res.json();
    if (user.name) {
      isLoggedIn = true;
      showUserMenu(user);
    }
  }
}

function showUserMenu(user) {
  const userMenu = document.getElementById("user-menu");
  const openLoginBtn = document.getElementById("open-login-btn");

  document.getElementById("user-name").textContent = user.name;
  document.getElementById("user-pic").src = user.profile_pic || "/static/default-avatar.png";

  userMenu.classList.remove("d-none");

  document.getElementById("profile-btn").onclick = () => window.location.href = "/profile";
  document.getElementById("logout-btn").onclick = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  };
}

function initSidebar() {
  const loginModal = document.getElementById("login-modal");
  const createCharBtn = document.getElementById("create-character-btn");

  createCharBtn.addEventListener("click", () => {
    if (!isLoggedIn) {
      alert("Please login first.");
      document.getElementById("login-modal").classList.remove("hidden");
      return;
    }
    window.location.href = "/character-create";
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
  loadRecentCharacters();
}
