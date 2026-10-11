document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("aiTutorForm");
  const input = document.getElementById("aiTutorInput");
  const codeInput = document.getElementById("aiTutorCode");
  const codeLanguage = document.getElementById("aiTutorCodeLanguage");
  const feed = document.getElementById("aiTutorFeed");
  const sendButton = document.getElementById("aiTutorSend");
  const status = document.getElementById("aiTutorStatus");
  const counter = document.getElementById("aiTutorCharacterCount");
  if (!form || !input || !codeInput || !feed || !sendButton || !status) return;

  const renderInline = (parent, text) => {
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    parts.forEach((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        parent.append(strong);
      } else if (part.startsWith("`") && part.endsWith("`")) {
        const code = document.createElement("code");
        code.textContent = part.slice(1, -1);
        parent.append(code);
      } else parent.append(document.createTextNode(part));
    });
  };

  const renderTutorText = (container, text) => {
    container.replaceChildren();
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    let paragraph = [];
    let list = null;
    let codeLines = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      const node = document.createElement("p");
      paragraph.forEach((line, index) => {
        if (index) node.append(document.createElement("br"));
        renderInline(node, line);
      });
      container.append(node);
      paragraph = [];
    };
    const flushList = () => { list = null; };
    const flushCode = () => {
      if (!codeLines) return;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.append(code);
      container.append(pre);
      codeLines = null;
    };

    for (const line of lines) {
      if (line.trimStart().startsWith("```")) {
        if (codeLines) flushCode();
        else { flushParagraph(); flushList(); codeLines = []; }
        continue;
      }
      if (codeLines) { codeLines.push(line); continue; }
      const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList();
        const node = document.createElement(heading[1].length === 1 ? "h3" : "h4");
        renderInline(node, heading[2]);
        container.append(node);
      } else if (bullet || numbered) {
        flushParagraph();
        const type = numbered ? "ol" : "ul";
        if (!list || list.tagName.toLowerCase() !== type) {
          flushList();
          list = document.createElement(type);
          container.append(list);
        }
        const item = document.createElement("li");
        renderInline(item, (bullet || numbered)[1]);
        list.append(item);
      } else if (!line.trim()) {
        flushParagraph(); flushList();
      } else {
        flushList();
        const quote = line.match(/^\s*&gt;\s?(.*)$/) || line.match(/^\s*>\s?(.*)$/);
        if (quote) {
          flushParagraph();
          const blockquote = document.createElement("blockquote");
          renderInline(blockquote, quote[1]);
          container.append(blockquote);
        } else paragraph.push(line);
      }
    }
    flushParagraph(); flushList(); flushCode();
  };

  feed.querySelectorAll(".tutor-message-assistant .tutor-message-content").forEach((message) => {
    renderTutorText(message, message.textContent);
  });

  const scrollToLatest = () => { feed.scrollTop = feed.scrollHeight; };
  const updateCount = () => {
    counter.textContent = `${input.value.length.toLocaleString()} / 6,000`;
  };
  const appendMessage = (role, text, { loading = false, error = false } = {}) => {
    const article = document.createElement("article");
    article.className = `tutor-message tutor-message-${role}${loading ? " is-loading" : ""}${error ? " tutor-message-error" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "tutor-message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = role === "assistant" ? "✦" : "Y";
    const main = document.createElement("div");
    main.className = "tutor-message-main";
    const author = document.createElement("span");
    author.className = "tutor-message-author";
    author.textContent = role === "assistant" ? "UPSHIFT Tutor" : "You";
    const content = document.createElement("div");
    content.className = "tutor-message-content";
    if (role === "assistant" && !loading && !error) renderTutorText(content, text);
    else content.textContent = text;
    main.append(author, content);
    article.append(avatar, main);
    feed.append(article);
    scrollToLatest();
    return { article, content };
  };

  const sendQuestion = async () => {
    const prompt = input.value.trim();
    if (!prompt || sendButton.disabled) return;
    if (prompt.length > 6000 || codeInput.value.length > 12000) {
      status.textContent = "Your question or code sample is longer than the allowed limit.";
      return;
    }

    const codeSnippet = codeInput.value.trim();
    appendMessage("user", codeSnippet ? `${prompt}\n\nCode sample (${codeLanguage.value}):\n${codeSnippet}` : prompt);
    const loadingMessage = appendMessage("assistant", "Thinking through your question", { loading: true });
    sendButton.disabled = true;
    input.disabled = true;
    status.textContent = "Tutor is working through your question…";
    sendButton.querySelector("span:first-child").textContent = "Thinking…";

    try {
      const response = await fetch("/student/ai-tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ prompt, codeSnippet, codeLanguage: codeLanguage.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `Tutor request failed (HTTP ${response.status}).`);

      loadingMessage.article.classList.remove("is-loading");
      renderTutorText(loadingMessage.content, data.reply || "The tutor returned an empty response.");
      input.value = "";
      codeInput.value = "";
      updateCount();
      status.textContent = data.saved === false
        ? "Reply received, but chat history could not be saved."
        : "Reply received. Ask a follow-up whenever you’re ready.";
    } catch (error) {
      loadingMessage.article.classList.remove("is-loading");
      loadingMessage.article.classList.add("tutor-message-error");
      loadingMessage.content.textContent = error instanceof TypeError
        ? "Could not reach the tutor service. Check your connection and try again."
        : error.message || "Could not get a tutor reply. Please try again.";
      status.textContent = "Your question is still here. You can retry after checking the connection.";
    } finally {
      sendButton.disabled = false;
      input.disabled = false;
      sendButton.querySelector("span:first-child").textContent = "Ask tutor";
      input.focus();
      scrollToLatest();
    }
  };

  form.addEventListener("submit", (event) => { event.preventDefault(); sendQuestion(); });
  input.addEventListener("input", updateCount);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  document.querySelectorAll("[data-tutor-suggestion]").forEach((button) => button.addEventListener("click", () => {
    input.value = button.dataset.tutorSuggestion || "";
    updateCount();
    input.focus();
  }));
  updateCount();
  scrollToLatest();
});
