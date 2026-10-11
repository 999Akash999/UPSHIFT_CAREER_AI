const AI_CONFIG = require("../config/aiConfig");

function toGeminiContents(messages = []) {
  const systemParts = [];
  const contents = [];

  for (const message of messages) {
    const text = typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? message.content.map((part) => part.text || "").join("\n")
        : String(message.content ?? "");
    if (!text.trim()) continue;

    if (message.role === "system" || message.role === "developer") {
      systemParts.push({ text });
      continue;
    }

    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];
    if (previous?.role === role) previous.parts[0].text += `\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  }

  return {
    contents,
    ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
  };
}

function parseJsonResponse(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (cause) {
    // Some provider responses include a short preface despite JSON mode.
    // Recover the structured object when the JSON itself is complete.
    const firstObject = cleaned.indexOf("{");
    const lastObject = cleaned.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      try { return JSON.parse(cleaned.slice(firstObject, lastObject + 1)); } catch { /* report the original parse error below */ }
    }
    const error = new Error("Gemini returned invalid JSON for a structured AI request.");
    error.cause = cause;
    throw error;
  }
}

const generateAIContent = async ({ messages, jsonMode = false, temperature = 0.3, maxTokens = 1500, timeoutMs = AI_CONFIG.timeoutMs }) => {
  if (!AI_CONFIG.isConfigured) {
    console.warn("⚠️ Gemini API key missing. Using the feature's local fallback response.");
    return null;
  }

  try {
    const request = toGeminiContents(messages);
    if (!request.contents.length) throw new Error("AI request did not contain any user messages.");

    // Gemini 3 models reject legacy sampling parameters such as temperature.
    // Keep temperature for older models, and use the supported thinking
    // controls for Gemini 3 instead.
    const isGemini3 = /^gemini-3(?:\.|-)/i.test(AI_CONFIG.model);

    const response = await fetch(
      `${AI_CONFIG.apiBaseUrl}/models/${encodeURIComponent(AI_CONFIG.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": AI_CONFIG.apiKey,
        },
        body: JSON.stringify({
          ...request,
          generationConfig: {
            maxOutputTokens: maxTokens,
            ...(isGemini3
              ? { thinkingConfig: { thinkingLevel: "low" } }
              : { temperature }),
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = result.error?.message || `Gemini API request failed with HTTP ${response.status}.`;
      const error = new Error(providerMessage);
      error.status = response.status;
      error.code = result.error?.status || result.error?.code;
      throw error;
    }

    const candidate = result.candidates?.[0];
    // Gemini 3 can return private reasoning parts alongside the user-facing
    // answer. Those parts are not output and must not be shown or parsed as JSON.
    const content = candidate?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("")
      .trim();
    if (!content) {
      const reason = candidate?.finishReason || result.promptFeedback?.blockReason;
      throw new Error(reason ? `Gemini returned no text (reason: ${reason}).` : "Gemini returned an empty response.");
    }

    return jsonMode ? parseJsonResponse(content) : content;
  } catch (error) {
    console.error("❌ Gemini Service Error:", JSON.stringify({
      message: error.message,
      status: error.status || null,
      code: error.code || null,
    }));
    const wrapped = new Error(`AI processing failed: ${error.message}`);
    wrapped.status = error.status === 429 ? 503 : (error.status || 502);
    wrapped.cause = error;
    throw wrapped;
  }
};

module.exports = { generateAIContent };
