function initTopbar() {
  fetch('/static/topbar.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById("topbar-container");
      container.innerHTML = html;

      const searchBtn = document.getElementById("search-btn");
      const searchBar = document.getElementById("search-bar");

      if (searchBtn && searchBar) {
        searchBtn.onclick = () => {
          const q = searchBar.value.trim();
          if (q) window.location.href = `/search?q=${encodeURIComponent(q)}`;
        };

        searchBar.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            const q = searchBar.value.trim();
            if (q) window.location.href = `/search?q=${encodeURIComponent(q)}`;
          }
        });
      }

      const backBtn = document.getElementById("back-button");
      if (backBtn && window.location.pathname !== '/' && document.referrer !== '') {
        backBtn.classList.remove('d-none');
        backBtn.onclick = () => history.back();
      }
    });
}
