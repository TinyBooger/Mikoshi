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
          if (!isLoggedIn) {
            alert("Please login first.");
            document.getElementById("login-modal").classList.remove("hidden");
            return;
          }
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
    if (user.name) {
      isLoggedIn = true;
      showUserMenu(user);
    }
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
    toggle.textContent = dropdown.style.display === "none" ? "▴" : "▾";
  });

  document.getElementById("profile-btn").addEventListener("click", () => {
    window.location.href = "/profile";
  });


  document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    isLoggedIn = false;
    location.reload();
  });
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
    characterModal.classList.remove("hidden");
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
