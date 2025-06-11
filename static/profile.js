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
    document.getElementById("edit-modal").classList.remove("hidden");
  });

  document.getElementById("close-edit-modal").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.add("hidden");
    loadProfile();
  });

  document.getElementById("save-edit").addEventListener("click", async () => {
    const name = document.getElementById("edit-name").value.trim();
    const pic = document.getElementById("edit-pic").files[0];

    const formData = new FormData();
    if (name) formData.append("name", name);
    if (pic) formData.append("profile_pic", pic);

    const res = await fetch("/api/update-profile", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) {
      document.getElementById("edit-modal").classList.add("hidden");
      loadProfile();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  setupProfilePage();

  fetch("/static/sidebar.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("sidebar-placeholder").innerHTML = html;
      const script = document.createElement("script");
      script.src = "/static/sidebar.js";
      script.onload = () => initSidebar();
      document.body.appendChild(script);
    });
});
