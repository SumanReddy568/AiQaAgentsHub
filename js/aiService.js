// js/aiService.js

import { state } from './state.js';
import { addApiCall } from './db.js';

// This is the only function that communicates with the API
async function fetchFromApi(prompt) {
    if (!state.apiKey) {
        throw new Error('API key not configured.');
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${state.selectedModel}:generateContent?key=${state.apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // UPDATED: Telling the API we expect a JSON response.
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    const usage = result.usageMetadata || { totalTokenCount: 0 }; // Extract usage metadata

    return { content, usage };
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