document.addEventListener("DOMContentLoaded", () => {
  const recentList = document.getElementById("recent-characters");
  const popularList = document.getElementById("popular-characters");
  const recommendedList = document.getElementById("recommended-characters");

  fetch("/api/characters")
    .then(res => res.json())
    .then(data => {
      Object.keys(data).forEach(name => {
        const card = document.createElement("div");
        card.className = "character-card";
        card.textContent = name;
        card.addEventListener("click", () => {
          window.location.href = `/chat?character=${encodeURIComponent(name)}`;
        });
        recentList.appendChild(card.cloneNode(true));
        popularList.appendChild(card.cloneNode(true));
        recommendedList.appendChild(card.cloneNode(true));
      });
    });

  document.getElementById("create-character-btn").addEventListener("click", () => {
    // Reuse existing modal logic if needed
    window.location.href = "/chat"; // or open modal if available
  });
});
