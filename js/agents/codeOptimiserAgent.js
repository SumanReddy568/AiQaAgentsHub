import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

/**
 * Optimizes code by removing redundant code and returns the optimized code snippet.
 * @param {string} code - The code to optimize.
 * @param {string} language - The programming language.
 * @returns {Promise<string>} - The optimized code snippet with analysis.
 */
export async function optimizeCodeWithSnippet(code, language) {
  const prompt = `You are a senior software engineer specializing in code optimization and clean code practices. Analyze the provided ${language} code and provide comprehensive optimizations.

CODE TO OPTIMIZE:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

OPTIMIZATION CRITERIA:
1. **Remove Redundancy**: Eliminate duplicate code, unused variables/functions, dead code
2. **Improve Efficiency**: Optimize algorithms, data structures, and expensive operations
3. **Enhance Readability**: Simplify complex logic, improve naming, add meaningful comments
4. **Follow Best Practices**: Apply language-specific idioms and patterns
5. **Maintain Functionality**: Ensure optimized code behaves identically to original
6. **Security**: Identify and fix potential security issues if present

ANALYSIS REQUIREMENTS:
- Identify specific optimization opportunities with reasoning
- Consider performance implications of changes
- Preserve or improve error handling
- Maintain or enhance code readability

RESPONSE FORMAT - Return in this exact structure:

# Code Optimization Analysis

## 📊 Optimization Summary
[Brief overview of changes made and expected improvements]

## 🔍 Key Changes Made
- [List of specific optimizations with brief explanations]
- [Example: "Removed duplicate API calls by caching results"]
- [Example: "Simplified nested conditionals using guard clauses"]

## 📝 Optimized Code
\`\`\`${language.toLowerCase()}
[OPTIMIZED CODE HERE - ready to use]
\`\`\`

## 📈 Expected Improvements
- **Performance**: [Describe performance gains if applicable]
- **Readability**: [Describe readability improvements]
- **Maintainability**: [Describe maintainability benefits]
- **Size Reduction**: [Note any code size reduction]

## ⚠️ Important Notes
[Any caveats, trade-offs, or considerations about the optimizations]

IMPORTANT: 
- The optimized code must be production-ready and fully functional
- Include only the optimized code in the code block, no diff markers
- Focus on practical, meaningful improvements over micro-optimizations
- Preserve all original functionality and error handling`;

  const startTime = Date.now();
  const { content, usage } = await fetchFromApi(prompt);
  const duration = Date.now() - startTime;

  await initDB();
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: 0,
    type: "optimizer",
    duration,
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}
