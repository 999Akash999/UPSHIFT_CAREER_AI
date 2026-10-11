const { generateAIContent } = require("./aiService");
const AI_CONFIG = require("../config/aiConfig");

const resolveDoubt = async ({ doubtTitle, description, codeSnippet, language = "javascript" }) => {
  const prompt = `Student has raised the following technical doubt:
Title: ${doubtTitle}
Description: ${description}
Code Context:
\`\`\`${language}${codeSnippet || "// No code provided"}
\`\`\`

Explain the bug or concept clearly. Provide:
1. Core explanation / Root cause
2. Refactored code snippet with inline comments
3. 2 key best practices to avoid this in the future`;

  const messages = [
    { role: "system", content: AI_CONFIG.systemPrompts.tutor },
    { role: "user", content: prompt },
  ];

  const response = await generateAIContent({ messages, temperature: 0.2, maxTokens: 1000 });
  return (
    response ||
    "### Solution\nPlease review your variable scope and ensure all asynchronous calls are properly awaited."
  );
};

module.exports = { resolveDoubt };