import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function getCodeExplanation(options) {
  const { code, language, framework } = options;
  const prompt = `
        Act as an expert Senior QA Automation Engineer providing a detailed code review and explanation for a junior engineer.
        The user has provided a code snippet written in ${language} using the ${framework} framework.

        Your explanation must be structured in markdown with the following sections:

        ### 1. High-Level Summary
        Start with a concise, one-paragraph summary of the test's primary goal and what it accomplishes.

        ### 2. Step-by-Step Workflow
        Provide a numbered list detailing the exact sequence of user actions and assertions the code performs. For example:
        1. Navigates to the login page.
        2. Enters a username into the email field.
        3. Clicks the submit button.
        4. Asserts that a welcome message is visible.

        ### 3. Detailed Code Breakdown
        Go through the code line-by-line or block-by-block. Explain what each part does, focusing on specific ${framework} API calls (e.g., \`page.locator()\`, \`cy.get()\`, \`driver.findElement()\`). Use markdown code blocks for clarity.

        ### 4. Advanced Concepts & Best Practices
        Identify and explain any advanced concepts used (e.g., async/await, Page Object Model, custom commands, hooks, waits).
        Conclude with 1-2 actionable suggestions for improvement, such as using data-testid attributes for more stable selectors, refactoring waits, or improving assertions.

        Here is the code snippet:
        \`\`\`${language.toLowerCase()}
        ${code}
        \`\`\`
    `;

  const startTime = Date.now(); // START TIMER
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime; // END TIMER

  await initDB(); // <-- ensure DB is ready before saving
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: 0,
    type: "explainer",
    duration: duration, // ADD DURATION
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}
