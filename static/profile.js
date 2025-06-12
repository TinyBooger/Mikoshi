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

  fetch("/api/characters")
      .then(res => res.json())
      .then(chars => {
        const list = document.getElementById("character-list");
        Object.entries(chars).forEach(([name, info]) => {
          if (info.creator_id == user.id) {
            const li = document.createElement("li");
            li.textContent = name;
            list.appendChild(li);
          }
        });
      });
}

function setupProfilePage() {
  document.getElementById("edit-profile-btn").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.remove("hidden");
  });

  document.getElementById("close-edit-modal").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.add("hidden");
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
      document.getElementById("edit-modal").classList.add("hidden");
      loadProfile();
      initSidebar();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupProfilePage();
  loadProfile();
});
