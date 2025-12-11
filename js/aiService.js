// js/aiService.js
import { state } from "./state.js";

// Replace this with your deployed Cloudflare Worker URL
// Example: "https://ai-gateway-proxy.yourname.workers.dev"
const CLOUDFLARE_WORKER_URL = "https://shy-poetry-1817.sumanreddy568.workers.dev"; // No trailing slash

const DEEPSEEK_API_URL = `${CLOUDFLARE_WORKER_URL}/deepseek/chat/completions`;
const OPENROUTER_API_URL = `${CLOUDFLARE_WORKER_URL}/openrouter/chat/completions`;
const GEMINI_GATEWAY_URL = `${CLOUDFLARE_WORKER_URL}/compat/chat/completions`;

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
  
  // Custom suggestion for CORS/Network errors with the Worker
  if (lastError.message.includes("Failed to fetch")) {
    console.error("POSSIBLE FIX: If you see 'ERR_QUIC_PROTOCOL_ERROR', go to chrome://flags/#enable-quic and DISABLE it.");
    console.error("If you are seeing a CORS error, ensure your Cloudflare Worker is deployed and the URL in js/aiService.js is correct.");
    throw new Error("Network/CORS/QUIC Error: Check console for fix instructions. Ensure Cloudflare Worker is deployed.");
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

  // Default: Gemini via Cloudflare Gateway
  const apiKey = state.geminiApiKey || state.apiKey;
  if (!apiKey) {
    throw new Error("API key not configured. Please set one on the main page.");
  }
  
  const modelName = state.selectedModel || "gemini-2.5-flash";
  const fullModelName = modelName.includes("/") ? modelName : `google-ai-studio/${modelName}`;

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
