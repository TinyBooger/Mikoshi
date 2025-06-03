require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: userMessage })
  });

  const data = await response.json();
  const reply = data?.[0]?.generated_text?.replace(userMessage, '') || 'No response.';
  res.json({ reply });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
