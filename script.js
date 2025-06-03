async function sendMessage() {
  const message = document.getElementById("input").value;
  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  document.getElementById("chat").innerText = data.reply;
}
