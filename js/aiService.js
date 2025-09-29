// js/aiService.js

import { state } from './state.js';
import { addApiCall } from './db.js';

async function fetchFromApi(prompt) {
    if (!state.apiKey) {
        throw new Error('API key not configured. Please set one on the main page.');
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${state.selectedModel || 'gemini-2.5-flash'}:generateContent?key=${state.apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    const usage = result.usageMetadata || { totalTokenCount: 0 };

    return { content, usage };
}

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

    const { content, usage } = await fetchFromApi(prompt);

    addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        locatorsGenerated: 0,
        type: 'explainer'
    }).catch(err => console.error("DB save failed:", err));

    return content;
}

export async function generateAiLocators(htmlContent) {
    const prompt = `Analyze this HTML. Identify key interactive elements. For each element, provide the most robust cssSelector and xpath. Prioritize selectors using id, data-testid, name, or other unique attributes. Return ONLY a valid JSON object following this exact schema: {"recommendations": [{"element": "description", "cssSelector": "selector", "xpath": "selector", "priority": "high|medium|low", "explanation": "reasoning"}]}.
    HTML: \`\`\`html\n${htmlContent}\n\`\`\``;

    const { content, usage } = await fetchFromApi(prompt);
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

    // Save to DB
    addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        locatorsGenerated: recommendations.length,
        type: 'locator'
    }).catch(err => console.error("DB save failed:", err));

    return recommendations.map(rec => ({ ...rec, isAI: true }));
}

export async function getChatResponse(query, htmlContent) {
    const prompt = `You are a web testing assistant. The user provides HTML and a question.
    HTML Context: \`\`\`html\n${htmlContent || 'No HTML provided.'}\n\`\`\`
    User Question: ${query}
    Provide a concise, helpful response using markdown.`;

    // Note: getChatResponse doesn't need the JSON cleaning because it expects markdown text.
    const { content, usage } = await fetchFromApi(prompt);

    // Save to DB
    addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        locatorsGenerated: 0,
        type: 'chat'
    }).catch(err => console.error("DB save failed:", err));

    return content;
}