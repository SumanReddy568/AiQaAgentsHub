// js/aiService.js
import { state } from "./state.js";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

async function fetchWithRetry(url, options, retries = 3, initialDelay = 1000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      // If response is ok, return it
      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx), except for 429 (Too Many Requests)
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        let errorText = `API Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorText = errorData.error?.message || errorText;
        } catch (e) {
          // Ignore if response is not json
        }
        throw new Error(errorText); // Fail immediately for non-retriable client errors
      }

      // For server errors (5xx) or 429, prepare to retry
      lastError = new Error(`API Error: ${response.status}`);
      try {
        const errorData = await response.json();
        lastError = new Error(
          errorData.error?.message || `API Error: ${response.status}`
        );
      } catch (e) {
        // Ignore if response is not json
      }
    } catch (error) {
      lastError = error;
      // This will catch network errors and non-retriable client errors
      if (error.message.startsWith("API Error: 4")) {
        // Non-retriable as thrown above
        throw error;
      }
    }

    if (i < retries - 1) {
      const delay = initialDelay * Math.pow(2, i);
      console.warn(
        `Request failed. Retrying in ${delay}ms... (${i + 1}/${retries})`
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError; // All retries failed
}

export async function fetchFromApi(
  prompt,
  systemPrompt = "You are a helpful assistant."
) {
  const startTime = Date.now();
  // Route based on provider
  const provider = state.provider || "gemini";

  if (provider === "deepseek") {
    const apiKey = state.deepseekApiKey || state.apiKey;
    if (!apiKey) throw new Error("DeepSeek API key not configured.");
    const response = await fetchWithRetry(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });
    if (!response.ok) {
      let errorText = `API Error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorText = errorData.error?.message || errorText;
      } catch {}
      throw new Error(errorText);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
    usage.totalTokenCount =
      usage.total_tokens ||
      (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    const duration = Date.now() - startTime;
    return { content, usage, duration };
  } else if (provider === "openrouter") {
    const apiKey = state.openrouterApiKey || state.apiKey;
    if (!apiKey) throw new Error("OpenRouter API key not configured.");
    const response = await fetchWithRetry(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: state.selectedModel || "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      let errorText = `API Error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorText = errorData.error?.message || errorText;
      } catch {}
      throw new Error(errorText);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
    usage.totalTokenCount =
      usage.total_tokens ||
      (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    const duration = Date.now() - startTime;
    return { content, usage, duration };
  }

  // Default: Gemini
  const apiKey = state.geminiApiKey || state.apiKey;
  if (!apiKey) {
    throw new Error("API key not configured. Please set one on the main page.");
  }
  const apiUrl = `${GEMINI_API_URL_BASE}${
    state.selectedModel || "gemini-2.5-flash"
  }:generateContent?key=${apiKey}`;

  const response = await fetchWithRetry(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || `API Error: ${response.status}`
    );
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
  const usage = result.usageMetadata || { totalTokenCount: 0 };
  const duration = Date.now() - startTime;
  return { content, usage, duration };
}
