document.getElementById("account-setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const name = document.getElementById("account-name").value.trim();
  const profilePic = document.getElementById("profile-pic").value.trim();

  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, profile_pic: profilePic })
  });

  const data = await res.json();
  alert(data.message || data.detail);

  if (res.ok) {
    window.location.href = "/";  // Redirect to homepage or dashboard
  }
});
