document.getElementById("account-setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const res = await fetch("/setup-account", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  alert(data.message || data.detail);

  if (res.ok) {
    window.location.href = "/";
  }
});
