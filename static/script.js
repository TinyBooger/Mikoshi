document.addEventListener("DOMContentLoaded", () => {
  const recentList = document.getElementById("recent-characters");
  const popularList = document.getElementById("popular-characters");
  const recommendedList = document.getElementById("recommended-characters");

  // Load top 10 popular characters
  fetch("/api/characters/popular")
    .then(res => res.json())
    .then(chars => {
      chars.forEach(char => {
        const card = document.createElement("div");
        card.className = "character-card";
        card.style.position = "relative";
        card.innerHTML = `
          <img src="${char.picture || '/static/default.png'}" alt="${char.name}" style="width:100%; border-radius:8px;">
          <div style="padding:4px; text-align:center;">${char.name}</div>
          <div style="position:absolute; bottom:4px; right:8px; font-size:12px; color:gray;">❤️ ${char.views}</div>
        `;
        card.addEventListener("click", () => {
          window.location.href = `/chat?character=${encodeURIComponent(char.id)}`;
        });
        popularList.appendChild(card);
      });
    });

  // Placeholder recent & recommended (left unchanged for now)
});
