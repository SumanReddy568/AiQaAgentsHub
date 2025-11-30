import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function getWcagExplanation(ruleName) {
  // Check for API key in localStorage
  const provider = window.AI_PROVIDER || localStorage.getItem('ai-provider') || 'gemini';
  const apiKeyField = `${provider}-api-key`;
  const apiKey = localStorage.getItem(apiKeyField);
  
  if (!apiKey) {
    throw new Error(`API key not configured for ${provider}. Please set one in settings.`);
  }

  const prompt = `You are an expert web accessibility specialist explaining WCAG guidelines to beginners.

A user is asking for an explanation of this WCAG rule: "${ruleName}"

Please provide a BEGINNER-FRIENDLY explanation with this exact structure:

## Rule Overview
- **What is this rule?** (explain in simple terms, no jargon)
- **Why does it matter?** (who benefits and why)
- **Who might be affected?** (e.g., people with screen readers, keyboard users, etc.)

## Real-World Example
Include a simple, relatable scenario showing why this rule matters in everyday use.

## The Good Way ✅
\`\`\`html
[Show the CORRECT implementation with comments explaining each part]
\`\`\`

## The Bad Way ❌
\`\`\`html
[Show the WRONG implementation with comments explaining what's missing]
\`\`\`

## How to Check If Your Code Passes
Provide 2-3 simple, practical testing steps anyone can follow:
1. [Step 1 - what to look for]
2. [Step 2 - what to check]
3. [Step 3 - verification]

## Impact Level
- **Severity:** High/Medium/Low (how critical is this?)
- **Who it affects:** [Brief description]

## Quick Tips
- Bullet point 1: Easy way to remember this rule
- Bullet point 2: Common mistake to avoid
- Bullet point 3: Tool or technique to help

## Learn More
- Official WCAG Guideline: [Link]
- MDN Documentation: [Link if available]
- Web Accessibility Initiative (WAI): [Link if available]

---
**Remember:** Accessibility isn't just about following rules—it's about making the web usable for everyone!`;

  try {
    const { content, usage, duration } = await fetchFromApi(prompt, null, {
      provider: provider,
      model: window.AI_MODEL || localStorage.getItem('selected-model')
    });

    await initDB();
    // Only call addApiCall ONCE per request
    await addApiCall({
      timestamp: new Date(),
      model: state.selectedModel,
      totalTokens: usage.totalTokenCount,
      promptTokens: usage.prompt_tokens || usage.promptTokenCount,
      responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
      type: "wcag-explainer",
      duration: duration || 0,
    }).catch((err) => console.error("DB save failed:", err));

    return {
      explanation: content,
      tokens: usage.totalTokenCount || 0,
    };
  } catch (error) {
    console.error("Error fetching WCAG explanation:", error);
    throw error;
  }
}

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
