document.getElementById("chat-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const inputEl = document.getElementById("input");
  const message = inputEl.value;
  inputEl.value = "";

  appendMessage("User", message);

  const persona = "You are a helpful, friendly assistant who responds with clear, complete sentences.";

  const response = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `${persona}\nUser: ${message}\nAssistant:`,
    }),
  });

  const data = await response.json();
  appendMessage("Assistant", data.response);
});

function appendMessage(sender, text) {
  const chatBox = document.getElementById("chat-box");
  const messageEl = document.createElement("div");
  messageEl.className = "message";
  messageEl.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatBox.appendChild(messageEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}
