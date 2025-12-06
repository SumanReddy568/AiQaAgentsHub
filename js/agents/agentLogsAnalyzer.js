import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

/**
 * Analyze agent logs and return AI-powered summary, error detection, and recommendations.
 * @param {string[]|string} logs - Array of log lines or a single log string.
 * @param {object} options - Optional: { agentType, context }
 * @returns {Promise<{summary: string, issues: string[], recommendations: string[], tokens: number}>}
 */
export async function analyzeAgentLogs(logs, options = {}) {
  const provider = window.AI_PROVIDER || localStorage.getItem('ai-provider') || 'gemini';
  const apiKeyField = `${provider}-api-key`;
  const apiKey = localStorage.getItem(apiKeyField);

  if (!apiKey) {
    throw new Error(`API key not configured for ${provider}. Please set one in settings.`);
  }

  const logsText = Array.isArray(logs) ? logs.join('\n') : logs;
  const agentType = options.agentType || "AI Agent";
  const context = options.context ? `Context: ${options.context}` : "";

  const prompt = `You are an expert AI agent log analyzer.
Below are logs from an ${agentType}.
${context}

TASKS:
1. Summarize the overall agent activity and key events.
2. Detect and list any errors, warnings, or anomalies.
3. Provide actionable recommendations for improving agent reliability or performance.
4. Highlight any patterns or repeated issues.
5. If logs are incomplete or unclear, note what is missing.

LOGS:
\`\`\`
${logsText}
\`\`\`

RESPONSE FORMAT:
{
  "summary": "Concise summary of agent activity.",
  "issues": ["List of detected errors/warnings/anomalies."],
  "recommendations": ["Actionable advice for improvement."],
  "tokens": 123
}
`;

  try {
    const { content, usage, duration } = await fetchFromApi(prompt, null, {
      provider: provider,
      model: window.AI_MODEL || localStorage.getItem('selected-model')
    });

    await initDB();
    await addApiCall({
      timestamp: new Date(),
      model: state.selectedModel,
      totalTokens: usage.totalTokenCount,
      promptTokens: usage.prompt_tokens || usage.promptTokenCount,
      responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
      type: "agent-logs-analyzer",
      duration: duration || 0,
    }).catch((err) => console.error("DB save failed:", err));

    // Try to parse JSON from AI response
    let result = {};
    try {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = match ? match[1] : content;
      result = JSON.parse(jsonStr);
    } catch (e) {
      result = { summary: content, issues: [], recommendations: [], tokens: usage.totalTokenCount || 0 };
    }

    return result;
  } catch (error) {
    console.error("Error analyzing agent logs:", error);
    throw error;
  }
}
