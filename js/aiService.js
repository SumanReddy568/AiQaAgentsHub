// js/aiService.js
/**
 * AI Service Layer
 * Routes requests to multiple AI providers via a Cloudflare Worker proxy.
 *
 * Providers supported:
 *  - DeepSeek
 *  - OpenRouter
 *  - Gemini (default)
 *
 * Includes:
 *  - Exponential retry logic
 *  - Provider-based routing
 *  - Usage + latency reporting
 */

import { state } from "./state.js";
import { showToast } from "./utils.js";
const CLOUDFLARE_WORKER_URL = "https://shy-poetry-1817.sumanreddy568.workers.dev";
const DEEPSEEK_API_URL = `${CLOUDFLARE_WORKER_URL}/deepseek/chat/completions`;
const OPENROUTER_API_URL = `${CLOUDFLARE_WORKER_URL}/openrouter/chat/completions`;
const GEMINI_GATEWAY_URL = `${CLOUDFLARE_WORKER_URL}/compat/chat/completions`;

/**
 * Performs a fetch with retry logic (exponential backoff).
 *
 * Retries only for:
 *  - Network errors
 *  - 5xx server errors
 *  - 429 (rate limit)
 *
 * Fails immediately on:
 *  - Non-429 4xx client errors
 *
 * @param {string} url - API endpoint
 * @param {object} options - fetch options
 * @param {number} retries - number of retry attempts
 * @param {number} initialDelay - starting retry delay (ms)
 * @returns {Promise<Response>}
 * @throws {Error}
 */
async function fetchWithRetry(url, options, retries = 3, initialDelay = 1000) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      // Fail immediately for client errors except 429
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        let errorText = `API Error: ${response.status}`;
        if (response.status === 404) {
          errorText = "Model or Endpoint not found (404). Check your provider settings.";
        }
        try {
          let errorData = await response.json();
          // Handle case where error is wrapped in an array [ { error: ... } ]
          if (Array.isArray(errorData) && errorData.length > 0) {
            errorData = errorData[0];
          }
          errorText = errorData.error?.message || errorData.message || errorText;
        } catch { }
        showToast(errorText, "error");
        throw new Error(errorText);
      }

      // Prepare retry error
      lastError = new Error(`API Error: ${response.status}`);
      try {
        let errorData = await response.json();
        if (Array.isArray(errorData) && errorData.length > 0) {
          errorData = errorData[0];
        }
        lastError = new Error(
          errorData.error?.message || errorData.message || `API Error: ${response.status}`
        );
      } catch { }
    } catch (error) {
      lastError = error;

      // Skip retries for direct 4xx errors thrown above
      if (error.message.startsWith("API Error: 4")) {
        throw error;
      }
    }

    // Apply exponential backoff
    if (i < retries - 1) {
      const delay = initialDelay * Math.pow(2, i);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  // Helpful guidance for common browser/network issues
  if (lastError.message.includes("Failed to fetch")) {
    lastError = new Error(
      "Network/CORS/QUIC Error: Verify Cloudflare Worker deployment and browser QUIC settings."
    );
  }

  showToast(lastError.message, "error");
  throw lastError;
}

/**
 * Routes a completion request through the selected provider.
 *
 * @param {string} prompt - user prompt
 * @param {string} systemPrompt - system instruction
 * @returns {Promise<{content: string, usage: object, duration: number}>}
 */
export async function fetchFromApi(
  prompt,
  systemPrompt = "You are a helpful assistant."
) {
  const startTime = Date.now();
  const provider = state.provider || "gemini";

  // ------------------------------
  // DeepSeek
  // ------------------------------
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
        const err = await response.json();
        errorText = err.error?.message || errorText;
      } catch { }
      throw new Error(errorText);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const usage = result.usage || {};
    usage.totalTokenCount =
      usage.total_tokens ||
      (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

    return {
      content,
      usage,
      duration: Date.now() - startTime,
    };
  }

  // ------------------------------
  // OpenRouter
  // ------------------------------
  if (provider === "openrouter") {
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
        const err = await response.json();
        errorText = err.error?.message || errorText;
      } catch { }
      throw new Error(errorText);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const usage = result.usage || {};
    usage.totalTokenCount =
      usage.total_tokens ||
      (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

    return {
      content,
      usage,
      duration: Date.now() - startTime,
    };
  }

  // ------------------------------
  // Gemini (Default)
  // ------------------------------
  const apiKey = state.geminiApiKey || state.apiKey;
  if (!apiKey) throw new Error("API key not configured.");

  const modelName = state.selectedModel || "gemini-2.5-flash";
  const fullModelName = modelName.includes("/")
    ? modelName
    : `google-ai-studio/${modelName}`;

  const response = await fetchWithRetry(GEMINI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: fullModelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  });

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";
  const usage = result.usage || {};
  usage.totalTokenCount =
    usage.total_tokens ||
    (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

  return {
    content,
    usage,
    duration: Date.now() - startTime,
  };
}
