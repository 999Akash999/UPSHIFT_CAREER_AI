(() => {
  const transcript = document.querySelector("[data-conversation-id]");
  if (!transcript || typeof io !== "function") return;

  const conversationId = transcript.dataset.conversationId;
  const currentUserId = transcript.dataset.currentUserId;
  const socket = io();

  const appendMessage = ({ senderId, senderName, body, createdAt }) => {
    const article = document.createElement("article");
    article.className = `conversation-message${String(senderId) === currentUserId ? " is-mine" : ""}`;

    const meta = document.createElement("div");
    meta.className = "conversation-message-meta";
    const sender = document.createElement("strong");
    sender.textContent = String(senderId) === currentUserId ? "You" : (senderName || "Recruiter");
    const time = document.createElement("time");
    time.dateTime = createdAt || new Date().toISOString();
    time.textContent = new Date(createdAt || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    meta.append(sender, time);

    const content = document.createElement("p");
    content.textContent = body || "";
    article.append(meta, content);
    transcript.append(article);
    transcript.scrollTop = transcript.scrollHeight;
  };

  transcript.scrollTop = transcript.scrollHeight;
  socket.on("new:recruiter-message", (message) => {
    if (String(message?.conversationId) !== conversationId || String(message?.senderId) === currentUserId) return;
    appendMessage(message);
  });
})();
