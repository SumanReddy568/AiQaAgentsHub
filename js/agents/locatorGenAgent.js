import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function generateAiLocators(htmlContent) {
  const prompt = `Analyze this HTML. Identify key interactive elements. For each element, provide the most robust cssSelector and xpath. Prioritize selectors using id, data-testid, name, or other unique attributes. Return ONLY a valid JSON object following this exact schema: {"recommendations": [{"element": "description", "cssSelector": "selector", "xpath": "selector", "priority": "high|medium|low", "explanation": "reasoning"}]}.
    HTML: \`\`\`html\n${htmlContent}\n\`\`\``;

  const startTime = Date.now(); // START TIMER
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime; // END TIMER
  let recommendations = [];

  try {
    // UPDATED: This now cleans the string before parsing, making it robust.
    const cleanJsonString = (str) => {
      if (!str) return null;
      const match = str.match(/```json\s*([\s\S]*?)\s*```/);
      return match ? match[1] : str;
    };

    const cleanedContent = cleanJsonString(content);
    const parsed = JSON.parse(cleanedContent);
    recommendations = parsed.recommendations || [];
  } catch (e) {
    console.error("Could not parse JSON from AI response:", e);
    console.error("Problematic AI response content:", content); // Log the bad response for debugging
    throw new Error("The AI returned an invalid format. Please try again.");
  }

  await initDB(); // <-- ensure DB is ready before saving
  // Save to DB
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: recommendations.length,
    type: "locator",
    duration: duration, // ADD DURATION
  }).catch((err) => console.error("DB save failed:", err));

  return recommendations.map((rec) => ({ ...rec, isAI: true }));
}
