import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function getChatResponse(query, htmlContent) {
  const prompt = `You are a web testing assistant. The user provides HTML and a question.
    HTML Context: \`\`\`html\n${htmlContent || "No HTML provided."}\n\`\`\`
    User Question: ${query}
    Provide a concise, helpful response using markdown.`;

  // Note: getChatResponse doesn't need the JSON cleaning because it expects markdown text.
  const startTime = Date.now(); // START TIMER
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime; 

  await initDB(); // <-- ensure DB is ready before saving
  // Save to DB
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: 0,
    type: "chat",
    duration: duration, // ADD DURATION
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}
