import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

/**
 * Optimizes code by removing redundant code and returns the optimized code snippet.
 * @param {string} code - The code to optimize.
 * @param {string} language - The programming language.
 * @returns {Promise<string>} - The optimized code snippet.
 */
export async function optimizeCodeWithSnippet(code, language) {
  const prompt = `
    You are an expert code optimizer. The user provides a code snippet in ${language}.
    Your task:
    - Remove all redundant, dead, or duplicate code.
    - Optimize for clarity and efficiency.
    - Return ONLY the optimized code in a markdown code block (\`\`\`${language.toLowerCase()}\`\`\`).
    - Return opitmised summary in markdown format.
    - Do NOT include any diff or extra commentary.

    Original code:
    \`\`\`${language.toLowerCase()}
    ${code}
    \`\`\`
        `;

  const startTime = Date.now();
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime;

  await initDB();
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: 0,
    type: "optimizer",
    duration,
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}
