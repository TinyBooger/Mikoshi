async function loadPublicProfile() {
  const pathParts = window.location.pathname.split("/");
  const userId = pathParts[pathParts.length - 1];
  if (!userId) {
    alert("Invalid user ID.");
    return;
  }

  const res = await fetch(`/api/user/${userId}`);
  if (!res.ok) {
    alert("User not found.");
    return;
  }

  const user = await res.json();
  document.getElementById("profile-pic").src = user.profile_pic || "/static/default-avatar.png";
  document.getElementById("profile-name").textContent = user.name || "Unknown";

  const charRes = await fetch(`/api/characters-created?user_id=`+userId);
  const characters = await charRes.json();

  if (characters.length > 0) {
    const container = document.getElementById("character-list");
    characters.forEach(c => {
      const div = document.createElement("div");
      div.className = "character-item";
      div.style = "display:flex; align-items:center; margin:10px 0; cursor:pointer;";
      div.onclick = () => window.location.href = `/chat?character=${c.id}`;

      div.innerHTML = `
        <img src="${c.picture || '/static/default.png'}" alt="${c.name}" style="width:50px;height:50px;border-radius:50%;margin-right:10px;">
        <span>${c.name}</span>
      `;
      container.appendChild(div);
    });
  }
}

document.addEventListener("DOMContentLoaded", loadPublicProfile);
