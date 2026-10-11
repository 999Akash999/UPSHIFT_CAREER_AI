async function executeTutorChat() {
  const input = document.getElementById("aiTutorInput");
  const feed = document.getElementById("aiTutorFeed");
  if (!input || !feed) return;

  const prompt = input.value.trim();
  if (!prompt) return;

  // Append user question
  const userMsg = document.createElement("div");
  userMsg.className = "chat-bubble user";
  userMsg.textContent = prompt;
  feed.appendChild(userMsg);
  input.value = "";
  feed.scrollTop = feed.scrollHeight;

  // Append loading state
  const assistantMsg = document.createElement("div");
  assistantMsg.className = "chat-bubble assistant";
  assistantMsg.textContent = "Synthesizing architectural guidance...";
  feed.appendChild(assistantMsg);
  feed.scrollTop = feed.scrollHeight;

  try {
    const res = await fetch("/ai/tutor/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    assistantMsg.innerHTML = data.reply || "Could not generate reply.";
  } catch (err) {
    assistantMsg.textContent = "Engine connection error. Please retry.";
  }

  feed.scrollTop = feed.scrollHeight;
}