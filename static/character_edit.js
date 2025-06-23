function enableEdit(id, editBtn) {
  const field = document.getElementById(id);
  const confirmBtn = editBtn.nextElementSibling;
  field.removeAttribute("readonly");
  field.classList.remove("readonly")
  field.classList.add("bg-warning-subtle");
  editBtn.classList.add("d-none");
  confirmBtn.classList.remove("d-none");
}

function disableEdit(id, confirmBtn) {
  const field = document.getElementById(id);
  const editBtn = confirmBtn.previousElementSibling;
  field.setAttribute("readonly", true);
  field.classList.add("readonly");
  field.classList.remove("bg-warning-subtle");
  confirmBtn.classList.add("d-none");
  editBtn.classList.remove("d-none");
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const charId = urlParams.get("id");
  if (!charId) return alert("Missing character ID");

  const nameInput = document.getElementById("char-name");
  const personaInput = document.getElementById("char-persona");
  const sampleInput = document.getElementById("char-sample");
  const pictureInput = document.getElementById("char-picture");

  const enableField = (input) => {
    input.removeAttribute("readonly");
    input.classList.add("border", "border-primary");
  };

  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.getAttribute("data-target");
      enableField(document.getElementById(field));
    });
  });

  // Load character data
  const res = await fetch(`/api/character/${charId}`);
  const char = await res.json();
  nameInput.value = char.name;
  personaInput.value = char.persona;
  sampleInput.value = (char.example_messages || []).map(m => `<${m.role}>: ${m.content}`).join("\n");

  // Submit updated form
  document.getElementById("character-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("id", charId);
    formData.append("name", nameInput.value);
    formData.append("persona", personaInput.value);
    formData.append("sample_dialogue", sampleInput.value);
    if (pictureInput.files[0]) {
      formData.append("picture", pictureInput.files[0]);
    }

    const resp = await fetch("/api/update-character", {
      method: "POST",
      body: formData
    });

    const data = await resp.json();
    alert(data.message || data.detail || "Update complete");
    if (resp.ok) location.reload();
  });
});
