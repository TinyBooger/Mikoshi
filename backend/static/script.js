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
        card.className = "card text-center";
        card.style.width = "150px";
        card.style.margin = "5px";
        card.style.cursor = "pointer";
        card.innerHTML = `
          <img src="${char.picture || '/static/default.png'}" class="card-img-top" alt="${char.name}" style="border-radius: 8px;">
          <div class="card-body p-2">
            <h6 class="card-title mb-1">${char.name}</h6>
            <p class="text-muted" style="font-size: 12px;">❤️ ${char.views}</p>
          </div>
        `;
        card.addEventListener("click", () => {
          window.location.href = `/chat?character=${encodeURIComponent(char.id)}`;
        });
        popularList.appendChild(card);
      });
    });

  // Placeholder recent & recommended (left unchanged for now)
});
