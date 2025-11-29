// js/aiService.js
import { state } from "./state.js";

export async function fetchFromApi(
  prompt,
  systemPrompt = "You are a helpful assistant."
) {
  // Route based on provider
  const provider = state.provider || "gemini";

  if (provider === "deepseek") {
    const apiKey = state.deepseekApiKey || state.apiKey;
    if (!apiKey) throw new Error("DeepSeek API key not configured.");
    const response = await fetch("https://api.deepseek.com/chat/completions", {
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
    return { content, usage };
  } else if (provider === "openrouter") {
    const apiKey = state.openrouterApiKey || state.apiKey;
    if (!apiKey) throw new Error("OpenRouter API key not configured.");
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
      }
    );
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
    return { content, usage };
  }

  // Default: Gemini
  const apiKey = state.geminiApiKey || state.apiKey;
  if (!apiKey) {
    throw new Error("API key not configured. Please set one on the main page.");
  }
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${
    state.selectedModel || "gemini-2.5-flash"
  }:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
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

  return { content, usage };
}
