document.addEventListener("DOMContentLoaded", () => {
  const recentList = document.getElementById("recent-characters");
  const popularList = document.getElementById("popular-characters");
  const recommendedList = document.getElementById("recommended-characters");

  fetch("/api/characters")
  .then(res => res.json())
  .then(data => {
    Object.entries(data).forEach(([id, char]) => {
      const createCard = () => {
        const card = document.createElement("div");
        card.className = "character-card";
        card.textContent = char.name;
        card.addEventListener("click", () => {
          window.location.href = `/chat?character=${encodeURIComponent(id)}`;
        });
        return card;
      };

      recentList.appendChild(createCard());
      popularList.appendChild(createCard());
      recommendedList.appendChild(createCard());
    });
  });
});
