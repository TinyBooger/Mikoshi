// static/character_create.js

async function submitCharacterForm(e) {
  e.preventDefault();

  const name = document.getElementById("char-name").value.trim();
  const persona = document.getElementById("char-persona").value.trim();
  const sample = document.getElementById("char-sample").value.trim();
  const picture = document.getElementById("char-picture").files[0];

  if (!name || !persona) {
    alert("Name and persona are required.");
    return;
  }

  const resUser = await fetch("/api/current-user");
  if (!resUser.ok) {
    alert("Please login first.");
    window.location.href = "/";
    return;
  }

  const lines = sample.split("\n").filter(l => l.trim());
  const messages = [];
  for (const line of lines) {
    if (line.startsWith("<user>:")) {
      messages.push({ role: "user", content: line.replace("<user>:", "").trim() });
    } else if (line.startsWith("<bot>:")) {
      messages.push({ role: "assistant", content: line.replace("<bot>:", "").trim() });
    }
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("persona", persona);
  formData.append("sample_dialogue", JSON.stringify(messages));
  if (picture) formData.append("picture", picture);

  const res = await fetch("/api/create-character", {
    method: "POST",
    body: formData,
    credentials: "include"
  });

  const data = await res.json();
  alert(data.message || data.detail);
  if (res.ok) {
    window.location.href = "/";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("character-form")?.addEventListener("submit", submitCharacterForm);
});
