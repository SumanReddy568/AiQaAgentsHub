// js/agents/usageGenAgent.js

import { state } from '../state.js';
import { fetchFromApi } from '../aiService.js';

/**
 * Generate code usage examples for locators
 * @param {Array} locators - Array of locator objects
 * @param {string} language - Programming language (java, python, javascript, csharp, ruby)
 * @param {string} framework - Testing framework (selenium, playwright, cypress, webdriverio, puppeteer)
 * @param {boolean} advanced - Whether to include advanced patterns
 * @returns {Promise<Object>} Usage examples with code snippets
 */
export async function generateUsageExamples(locators, language, framework, advanced = false) {
    const apiKey = state.apiKey;
    const provider = state.provider || 'gemini';

    if (!apiKey) {
        throw new Error('API key not configured');
    }

    // Prepare locator summary for the AI
    const locatorSummary = locators.slice(0, 5).map(loc => ({
        type: loc.type,
        locator: loc.locator,
        explanation: loc.explanation
    }));

    const prompt = `You are an expert test automation engineer. Generate practical code examples using these locators:

${JSON.stringify(locatorSummary, null, 2)}

Requirements:
- Programming Language: ${language}
- Testing Framework: ${framework}
- Advanced Patterns: ${advanced ? 'Yes (include Page Object Model, waits, error handling, reusable methods)' : 'No (basic examples only)'}

Generate:
1. Basic usage examples for each locator type
2. ${advanced ? 'Advanced patterns including Page Object Model, explicit waits, error handling, and reusable helper methods' : 'Simple find and interact examples'}
3. Best practices for ${framework} with ${language}

Return ONLY a valid JSON object with this structure:
{
  "basicExamples": [
    {
      "title": "Example title",
      "code": "code snippet",
      "description": "what this does"
    }
  ],
  "advancedExamples": [
    {
      "title": "Advanced pattern title",
      "code": "code snippet",
      "description": "explanation"
    }
  ],
  "bestPractices": [
    "practice 1",
    "practice 2"
  ]
}

Make the code practical, production-ready, and follow ${language} conventions.`;

    try {
        const { content } = await fetchFromApi(prompt);
        return parseUsageResponse(content);
    } catch (error) {
        console.error('Usage generation failed:', error);
        throw error;
    }
}

function parseUsageResponse(text) {
    // Extract JSON from markdown code blocks if present
    let jsonText = text.trim();
    
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
        jsonText = jsonMatch[1];
    }

    try {
        const parsed = JSON.parse(jsonText);
        return {
            basicExamples: parsed.basicExamples || [],
            advancedExamples: parsed.advancedExamples || [],
            bestPractices: parsed.bestPractices || []
        };
    } catch (error) {
        console.error('Failed to parse usage response:', error);
        throw new Error('Invalid response format from AI');
    }
}

