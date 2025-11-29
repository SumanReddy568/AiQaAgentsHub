import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function generateWcagA11yExplainer(htmlContent, wcagRule = null) {
  const rulePrompt = wcagRule
    ? `Focus specifically on WCAG rule: ${wcagRule}`
    : "Cover key WCAG 2.1 AA level guidelines relevant to the provided HTML content.";

  const prompt = `You are an expert web accessibility specialist with deep knowledge of WCAG 2.1 guidelines.
  ANALYZE this HTML content and provide comprehensive WCAG accessibility explanations.

  REQUIREMENTS:
  ${rulePrompt}
  
  FOR EACH WCAG RULE, provide:
  1. Complete rule description and requirements
  2. Why it matters for users with disabilities
  3. GOOD example implementation
  4. BAD example to avoid
  5. How to test for compliance
  6. Priority level (high/medium/low) based on impact
  7. E2E testing considerations
  8. Reference links to official documentation

HTML CONTEXT:
\`\`\`html
${htmlContent}
\`\`\`

RESPONSE FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "rules": [
    {
      "ruleId": "WCAG_REFERENCE_CODE",
      "ruleName": "Descriptive Rule Name",
      "description": "Complete explanation of the rule and requirements",
      "importance": "Why this matters for accessibility",
      "goodExample": "<code>Well implemented HTML example</code>",
      "badExample": "<code>Problematic HTML example</code>",
      "testingMethods": ["Manual testing approach", "Automated testing tools"],
      "priority": "high|medium|low",
      "e2eConsiderations": "How to test this in end-to-end automation",
      "references": [
        {"name": "WCAG Official", "url": "https://www.w3.org/TR/WCAG21/#reference"},
        {"name": "MDN Web Docs", "url": "https://developer.mozilla.org/en-US/docs/Web/Accessibility/Reference"}
      ]
    }
  ]
}

IMPORTANT: Ensure the JSON is valid and properly formatted. Include practical, actionable advice.`;

  const startTime = Date.now();
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime;
  let rules = [];

  try {
    const cleanJsonString = (str) => {
      if (!str) return null;
      const match = str.match(/```json\s*([\s\S]*?)\s*```/);
      return match ? match[1] : str;
    };

    const cleanedContent = cleanJsonString(content);
    const parsed = JSON.parse(cleanedContent);
    rules = parsed.rules || [];
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
    rulesGenerated: rules.length,
    type: "a11y",
    duration: duration,
  }).catch((err) => console.error("DB save failed:", err));

  return rules.map((rule) => ({ ...rule, isAI: true }));
}
