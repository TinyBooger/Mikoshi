document.getElementById("account-setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const res = await fetch("/api/account-setup", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  alert(data.message || JSON.stringify(data));

  if (res.ok) {
    window.location.href = "/";
  }
});
