import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function generateAiLocators(htmlContent) {
  const initialPrompt = `You are an expert web automation engineer specializing in creating robust, maintainable locators for test automation.
  ANALYZE this HTML and identify key interactive elements that would be important for UI testing.

  CRITERIA for element selection:
  - Focus on interactive elements: buttons, links, forms, inputs, dropdowns, checkboxes
  - Include navigation elements and key calls-to-action
  - Prioritize elements that would be commonly used in test scenarios

  FOR EACH ELEMENT, provide:
  1. A descriptive name (e.g., "login-button")
  2. ALL available locator types where applicable. If a locator type is not applicable or valid for the element, return null or an empty string.
     - cssSelector: Locates elements matching a CSS selector
     - xpath: Locates elements matching an XPath expression
     - id: Locates elements whose ID attribute matches the search value
     - name: Locates elements whose NAME attribute matches the search value
     - tagName: Locates elements whose tag name matches the search value (use only if unique or specific)
     - className: Locates elements whose class name contains the search value. (Compound class names are not permitted)
     - linkText: Locates anchor elements whose visible text matches the search value
     - partialLinkText: Locates anchor elements whose visible text contains the search value
  3. Priority level (high/medium/low)
  4. Brief explanation

  HTML CONTEXT:
  \`\`\`html
  ${htmlContent}
  \`\`\`

  RESPONSE FORMAT: Return ONLY a valid JSON object with this exact structure:
  {
    "recommendations": [
      {
        "element": "descriptive name",
        "cssSelector": "selector",
        "xpath": "xpath",
        "id": "value or null",
        "name": "value or null",
        "tagName": "value or null",
        "className": "value or null",
        "linkText": "value or null",
        "partialLinkText": "value or null",
        "priority": "high|medium|low",
        "explanation": "reasoning"
      }
    ]
  }
  `;

  const startTime = Date.now();
  
  let totalUsage = {
      promptTokens: 0,
      responseTokens: 0,
      totalTokens: 0
  };

  const updateUsage = (usage) => {
      if (!usage) return;
      totalUsage.promptTokens += (usage.prompt_tokens || usage.promptTokenCount || 0);
      totalUsage.responseTokens += (usage.completion_tokens || usage.candidatesTokenCount || 0);
      totalUsage.totalTokens += (usage.totalTokenCount || 0);
  };

  // Step 1: Generate Initial Locators
  let { recommendations, usage: usage1 } = await getAiResponse(initialPrompt);
  updateUsage(usage1);

  // Step 2: Validate
  if (recommendations.length > 0) {
      const { recommendations: refined, usage: usage2 } = await validateAndRefineLocators(htmlContent, recommendations);
      updateUsage(usage2);
      if (refined && refined.length > 0) {
          recommendations = refined;
      }
  }

  const duration = Date.now() - startTime;

  await initDB();
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: totalUsage.totalTokens,
    promptTokens: totalUsage.promptTokens,
    responseTokens: totalUsage.responseTokens,
    locatorsGenerated: recommendations.length,
    type: "locator",
    duration: duration,
  }).catch((err) => console.error("DB save failed:", err));

  return recommendations.map((rec) => ({ ...rec, isAI: true }));
}

async function getAiResponse(prompt) {
    try {
        const { content, usage } = await fetchFromApi(prompt);
        const cleanJsonString = (str) => {
            if (!str) return null;
            const match = str.match(/```json\s*([\s\S]*?)\s*```/);
            return match ? match[1] : str;
        };
        const cleanedContent = cleanJsonString(content);
        const parsed = JSON.parse(cleanedContent);
        return { recommendations: parsed.recommendations || [], usage };
    } catch (e) {
        console.error("AI parsing error:", e);
        return { recommendations: [], usage: null };
    }
}

async function validateAndRefineLocators(htmlContent, currentRecommendations) {
    const validationPrompt = `
    You are a QA Lead Reviewer.
    I have a list of generated locators for the following HTML.
    
    HTML:
    \`\`\`html
    ${htmlContent}
    \`\`\`
    
    GENERATED LOCATORS:
    ${JSON.stringify(currentRecommendations, null, 2)}
    
    TASK:
    1. Review each locator for validity against the HTML.
    2. CORRECT any locators that are broken, incorrect, or too brittle.
    3. Ensure 'className' does not contain spaces (compound classes are not permitted).
    4. Ensure 'id' and 'name' actually exist in the HTML.
    5. If a locator is invalid or duplicates another element incorrectly, set it to null.
    6. Return the polished, validated list of recommendations in the SAME JSON format.
    
    RESPONSE FORMAT:
    {
        "recommendations": [ ... ]
    }
    `;

    return getAiResponse(validationPrompt);
}
