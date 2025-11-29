import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function generateAiLocators(htmlContent) {
  const prompt = `You are an expert web automation engineer specializing in creating robust, maintainable locators for test automation.
  ANALYZE this HTML and identify key interactive elements that would be important for UI testing.

  CRITERIA for element selection:
  - Focus on interactive elements: buttons, links, forms, inputs, dropdowns, checkboxes
  - Include navigation elements and key calls-to-action
  - Prioritize elements that would be commonly used in test scenarios

  FOR EACH ELEMENT, provide:
  1. A descriptive name that reflects its function (e.g., "login-button", "search-input")
  2. The MOST ROBUST cssSelector possible, prioritizing:
    - data-testid attributes first
    - id attributes second
    - name attributes third
    - aria-label or other accessibility attributes fourth
    - semantic class names or attributes fifth
    - Avoid fragile selectors based on position or dynamic classes
  3. A reliable xpath that's not brittle
  4. Priority level (high for critical interactions, medium for important, low for secondary)
  5. Brief explanation of why this selector approach is robust

HTML CONTEXT:
\`\`\`html
${htmlContent}
\`\`\`

RESPONSE FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "recommendations": [
    {
      "element": "clear descriptive name",
      "cssSelector": "robust.selector",
      "xpath": "//robust[xpath]",
      "priority": "high|medium|low",
      "explanation": "Concise reasoning for selector choice"
    }
  ]
}

IMPORTANT: Ensure the JSON is valid and properly formatted.`;

  const startTime = Date.now();
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime;
  let recommendations = [];

  try {
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
    console.error("Problematic AI response content:", content);
    throw new Error("The AI returned an invalid format. Please try again.");
  }

  await initDB();
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: recommendations.length,
    type: "locator",
    duration: duration,
  }).catch((err) => console.error("DB save failed:", err));

  return recommendations.map((rec) => ({ ...rec, isAI: true }));
}
