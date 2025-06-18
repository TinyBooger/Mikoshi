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
      sidebar.innerHTML = '<li class="list-group-item text-muted">No recent chats</li>';
      return;
    }

    recentChars.forEach(c => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action d-flex align-items-center gap-2";
      btn.onclick = () => window.location.href = `/chat?character=${c.id}`;
      btn.innerHTML = `
        <img src="${c.picture || '/static/default.png'}" alt="${c.name}" class="rounded-circle" style="width:30px; height:30px;">
        <span>${c.name}</span>
      `;
      sidebar.appendChild(btn);
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

  if (openLoginBtn) openLoginBtn.classList.add("d-none");

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
  console.log("Sidebar loaded")
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
