document.addEventListener("DOMContentLoaded", () => {
  const recentList = document.getElementById("recent-characters");
  const popularList = document.getElementById("popular-characters");
  const recommendedList = document.getElementById("recommended-characters");
  const loginModal = document.getElementById("login-modal");

  fetch("/api/characters")
    .then(res => res.json())
    .then(data => {
      Object.keys(data).forEach(name => {
        const createCard = () => {
          const card = document.createElement("div");
          card.className = "character-card";
          card.textContent = name;
          card.addEventListener("click", () => {
            window.location.href = `/chat?character=${encodeURIComponent(name)}`;
          });
          return card;
        };

        recentList.appendChild(createCard());
        popularList.appendChild(createCard());
        recommendedList.appendChild(createCard());
      });
    });

  document.getElementById("create-character-btn").addEventListener("click", () => {
    window.location.href = "/chat";
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
