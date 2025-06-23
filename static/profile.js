// static/profile.js

async function loadProfile() {
  const res = await fetch("/api/current-user");
  if (!res.ok) {
    alert("Please login first.");
    window.location.href = "/";
    return;
  }
  const user = await res.json();
  document.getElementById("profile-pic").src = user.profile_pic || "/static/default-avatar.png";
  document.getElementById("profile-name").textContent = user.name;
}

function setupProfilePage() {
  document.getElementById("edit-profile-btn").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.remove("d-none");
  });

  document.getElementById("close-edit-modal").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.add("d-none");
    loadProfile();
  });

  document.getElementById("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent default form reload

    const name = document.getElementById("edit-name").value.trim();
    const pic = document.getElementById("edit-pic").files[0];

    const formData = new FormData();
    if (name) formData.append("name", name);
    if (pic) formData.append("profile_pic", pic);

    const res = await fetch("/api/update-profile", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) {
      document.getElementById("edit-modal").classList.add("d-none");
      loadProfile();
      initSidebar();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupProfilePage();
  loadProfile();

  // Fetch user characters
  const res = await fetch("/api/characters-created");
  const characters = await res.json();

  if (characters.length > 0) {
    const main = document.getElementById("main-content");
    const section = document.createElement("section");
    section.innerHTML = `<div id="character-list" style="margin-top:10px;"></div>`;
    main.appendChild(section);

    const container = document.getElementById("character-list");
    characters.forEach(c => {
      const card = document.createElement("div");
      card.className = "card";
      card.style = "width: 150px; cursor: pointer;";
      card.onclick = () => window.location.href = `/chat?character=${c.id}`;

      card.innerHTML = `
        <img src="${c.picture || '/static/default.png'}" class="card-img-top" alt="${c.name}" style="border-radius: 8px;">
        <div class="card-body p-2">
          <h6 class="card-title mb-1 d-flex justify-content-between align-items-center">
            ${c.name}
            <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); window.location.href='/edit-character?id=${c.id}'">
              <i class="bi bi-pencil"></i>
            </button>
          </h6>
          <p class="text-muted mb-0" style="font-size: 12px;">❤️ ${c.views}</p>
        </div>
      `;
      container.appendChild(card);
    });

  }
});
