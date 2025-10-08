// js/aiService.js

import { state } from './state.js';
import { addApiCall, initDB } from './db.js'; // <-- import initDB

export async function fetchFromApi(prompt) {
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
                temperature: 1
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

    const startTime = Date.now(); // START TIMER
    const { content, usage } = await fetchFromApi(prompt);
    const duration = Date.now() - startTime; // END TIMER

    await initDB(); // <-- ensure DB is ready before saving
    await addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        locatorsGenerated: 0,
        type: 'explainer',
        duration: duration // ADD DURATION
    }).catch(err => console.error("DB save failed:", err));

    return content;
}

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
        locatorsGenerated: recommendations.length,
        type: 'locator',
        duration: duration // ADD DURATION
    }).catch(err => console.error("DB save failed:", err));

    return recommendations.map(rec => ({ ...rec, isAI: true }));
}

export async function getChatResponse(query, htmlContent) {
    const prompt = `You are a web testing assistant. The user provides HTML and a question.
    HTML Context: \`\`\`html\n${htmlContent || 'No HTML provided.'}\n\`\`\`
    User Question: ${query}
    Provide a concise, helpful response using markdown.`;

    // Note: getChatResponse doesn't need the JSON cleaning because it expects markdown text.
    const startTime = Date.now(); // START TIMER
    const { content, usage } = await fetchFromApi(prompt);
    const duration = Date.now() - startTime; // END TIMER


    await initDB(); // <-- ensure DB is ready before saving
    // Save to DB
    await addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        locatorsGenerated: 0,
        type: 'chat',
        duration: duration // ADD DURATION
    }).catch(err => console.error("DB save failed:", err));

    return content;
}

/**
 * Compares two pieces of content and returns a diff with AI summary.
 * @param {Object} options
 * @param {string} options.left - Left content.
 * @param {string} options.right - Right content.
 * @param {string} options.type - File type (json, csv, text, etc).
 * @returns {Promise<{diff: string, summary: string}>}
 */
export async function getDiffAnalysis({ left, right, type }) {
    const prompt = `
        Compare the following two ${type.toUpperCase()} files/contents.
        1. Show a unified diff (in markdown code block, language "diff") highlighting all differences.
        2. Provide a concise AI summary of the key differences, breaking down added, removed, and changed items.
        3. If possible, highlight structural or semantic changes (not just line-by-line).
        Format:
        ## Diff
        \`\`\`diff
        ...diff here...
        \`\`\`
        ## AI Summary
        ...summary here...

        --- LEFT (${type}) ---
        \`\`\`${type}
        ${left}
        \`\`\`
        --- RIGHT (${type}) ---
        \`\`\`${type}
        ${right}
        \`\`\`
    `;
    const startTime = Date.now();
    const { content, usage } = await fetchFromApi(prompt);
    const duration = Date.now() - startTime;

    await initDB(); // <-- ensure DB is ready before saving
    // Save to DB
    await addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        locatorsGenerated: 0,
        type: 'diff',
        duration
    }).catch(err => console.error("DB save failed:", err));

    // Parse out diff and summary
    let diff = '', summary = '';
    if (content) {
        console.log("Raw API response:", content);

        // More robust regex that handles empty diffs better
        const diffMatch = content.match(/```diff\s*([\s\S]*?)```/);

        if (diffMatch) {
            diff = diffMatch[1].trim();
            // If diff is just the file headers with no actual differences, set a clearer message
            if (diff.match(/^---.*\n\+\+\+.*$/) && !diff.includes('@@ ')) {
                diff = "No differences found between files.";
            }
        } else {
            // If no diff block found but we have content, something might be wrong with the format
            console.warn("No diff block found in response");
            diff = "No formatted diff available.";
        }

        const summaryMatch = content.match(/## AI Summary\s*([\s\S]*)$/i);
        if (summaryMatch) {
            summary = summaryMatch[1].trim();
        } else {
            // If we have content but no summary section, use all content after removing any diff blocks
            summary = content.replace(/## Diff\s*```diff[\s\S]*?```/g, '').trim();
        }
    } else {
        summary = "The AI returned an empty response. Please check your API key and model configuration.";
    }

    return { diff, summary };
}

/**
 * Analyzes webpage performance metrics and provides recommendations
 * @param {Object} metrics - Performance metrics collected from the page
 * @returns {Promise<string>} - Markdown formatted analysis
 */
export async function analyzePagePerformance(metrics) {
    // Format metrics into readable blocks
    const loadTime = metrics.timing.duration.toFixed(2);
    const transferSize = (metrics.resources.sizes.transfer / 1024).toFixed(2);
    const resourceCount = metrics.resources.totalResources;
    const fcp = metrics.paint?.firstContentfulPaint?.toFixed(2) || 'N/A';

    const prompt = `
        Analyze these web performance metrics and provide recommendations:
        
        Load Time: ${loadTime}ms
        Resources: ${resourceCount}
        Transfer Size: ${transferSize}KB
        First Contentful Paint: ${fcp}ms
        Protocol: ${metrics.security.protocol}
        
        Full metrics: ${JSON.stringify(metrics, null, 2)}

        Provide analysis in this exact markdown format:

        # Performance Analysis for ${metrics.url}

        ## Overview
        Quick summary of the page's performance (1-2 sentences).

        ## Key Metrics
        - **Load Time**: ${loadTime}ms
        - **Resources**: ${resourceCount} items loaded
        - **Transfer Size**: ${transferSize}KB
        - **First Paint**: ${metrics.paint?.firstPaint?.toFixed(2) || 'N/A'}ms
        - **First Contentful Paint**: ${fcp}ms

        ## Performance Score
        Rate the performance as Great ✅, Good ⚠️, or Needs Improvement ❌

        ## Critical Issues
        List any performance bottlenecks or concerns.

        ## Recommendations
        Provide 3-5 specific, actionable improvements.

        ## Technical Details
        Brief analysis of any relevant technical metrics.
    `;

    const startTime = Date.now();
    const { content, usage } = await fetchFromApi(prompt);
    const duration = Date.now() - startTime;

    await initDB(); // <-- ensure DB is ready before saving
    // Save to DB
    await addApiCall({
        timestamp: new Date(),
        model: state.selectedModel,
        totalTokens: usage.totalTokenCount,
        type: 'perf',
        duration
    }).catch(err => console.error("DB save failed:", err));

    return content;
}

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
        locatorsGenerated: 0,
        type: 'optimizer',
        duration
    }).catch(err => console.error("DB save failed:", err));

    return content;
}

/**
 * Logs a tech news API call for dashboard tracking.
 * @param {Object} options
 * @param {number} duration - Duration in ms
 * @param {number} count - Number of news items fetched
 * @param {number} totalTokens - (optional) Total tokens used
 * @param {number} promptTokens - (optional) Prompt tokens
 * @param {number} responseTokens - (optional) Response tokens
 */
export async function logTechNewsApiCall({
    duration = 0,
    count = 0,
    totalTokens = 0,
    promptTokens = 0,
    responseTokens = 0
} = {}) {
    await initDB();
    await addApiCall({
        timestamp: new Date(),
        model: 'external-news',
        totalTokens,
        promptTokens,
        responseTokens,
        locatorsGenerated: count,
        type: 'technews',
        duration
    }).catch(err => console.error("DB save failed (technews):", err));
}