import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

/**
 * Compares two pieces of content and returns a diff with AI summary.
 * @param {Object} options
 * @param {string} options.left - Left content.
 * @param {string} options.right - Right content.
 * @param {string} options.type - File type (json, csv, text, etc).
 * @param {string} options.context - Optional context about the comparison.
 * @returns {Promise<{diff: string, summary: string, analysis: string, changes: Array}>}
 */
export async function getDiffAnalysis({ left, right, type, context = "" }) {
  const prompt = `You are an expert code and content analyst specializing in comparative analysis. Perform a comprehensive comparison of the two ${type.toUpperCase()} contents provided.

COMPARISON CONTEXT: ${context || "General comparison"}

ANALYSIS REQUIREMENTS:
1. **Structural Analysis**: Identify high-level structural changes, not just line-by-line differences
2. **Semantic Understanding**: Explain the meaning and impact of changes
3. **Categorization**: Classify changes as additions, removals, modifications, or reorganizations
4. **Impact Assessment**: Evaluate the significance of each change (critical, major, minor, cosmetic)
5. **Pattern Recognition**: Identify any patterns or systematic changes

COMPARISON FRAMEWORK:
- **Data Changes**: Modifications to actual data values
- **Structural Changes**: Changes to schema, organization, or format
- **Functional Changes**: Alterations that affect behavior or functionality
- **Quality Changes**: Improvements or regressions in code quality/data integrity

RESPONSE FORMAT - Return in this exact structure:

## 📊 Comparison Summary
[2-3 sentence executive summary highlighting the most significant changes]

## 🔍 Detailed Analysis
[In-depth analysis of the changes, organized by category and impact]

## 📋 Change Breakdown
### Added
- [List of significant additions with context]

### Removed  
- [List of significant removals with context]

### Modified
- [List of key modifications with before/after context where relevant]

### Structural
- [Any organizational or architectural changes]

## 🎯 Impact Assessment
- **Critical Changes**: [List and explain]
- **Major Changes**: [List and explain] 
- **Minor Changes**: [List and explain]

## 🔧 Technical Diff
\`\`\`diff
[Unified diff format showing precise line-by-line changes]
\`\`\`

## 💡 Recommendations
[Actionable insights or next steps based on the changes found]

CONTENT TO COMPARE:
--- LEFT CONTENT (${type}) ---
${left}
--- RIGHT CONTENT (${type}) ---
${right}

IMPORTANT: 
- Focus on meaningful changes, not just formatting differences
- Provide context about WHY changes matter
- Be specific and reference actual content where possible
- Use proper diff syntax with +++ and --- headers`;

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
    type: "diff",
    duration,
  }).catch((err) => console.error("DB save failed:", err));

  // Enhanced parsing with better error handling and structure
  let diff = "",
    summary = "",
    analysis = "",
    changes = [];

  if (!content) {
    return {
      diff: "No response generated",
      summary:
        "The AI returned an empty response. Please check your API key and model configuration.",
      analysis: "",
      changes: [],
    };
  }

  try {
    console.log("Raw API response:", content);

    // Parse diff section with improved regex
    const diffMatch = content.match(/```diff\s*([\s\S]*?)```/);
    if (diffMatch && diffMatch[1]) {
      diff = diffMatch[1].trim();
      // Check if diff contains actual changes or just headers
      if (diff.match(/^--- [^\n]+\n\+\+\+ [^\n]+$/) && !diff.includes("@@")) {
        diff = "No meaningful differences detected between the contents.";
      }
    } else {
      diff = "No formatted diff available in response.";
    }

    // Parse summary section
    const summaryMatch = content.match(
      /## 📊 Comparison Summary\s*\n([\s\S]*?)(?=\n## |$)/
    );
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // Parse detailed analysis section
    const analysisMatch = content.match(
      /## 🔍 Detailed Analysis\s*\n([\s\S]*?)(?=\n## |$)/
    );
    if (analysisMatch) {
      analysis = analysisMatch[1].trim();
    }

    // Parse change breakdown sections
    const changes = {
      added: parseChangeSection(content, "### Added"),
      removed: parseChangeSection(content, "### Removed"),
      modified: parseChangeSection(content, "### Modified"),
      structural: parseChangeSection(content, "### Structural"),
    };

    // Fallback: if structured parsing fails, provide meaningful content
    if (!summary && !analysis) {
      const fallbackSummary = content.split("## 🔧 Technical Diff")[0];
      if (fallbackSummary) {
        summary = fallbackSummary.trim();
      } else {
        summary =
          "Unable to parse structured analysis. Raw response available.";
      }
    }
  } catch (error) {
    console.error("Error parsing AI response:", error);
    summary = "Error parsing the comparison results. Please try again.";
    diff = "Parsing error occurred.";
  }

  return {
    diff,
    summary,
    analysis,
    changes,
    rawResponse: content, // Include raw response for debugging
  };
}

/**
 * Helper function to parse change sections from the response
 */
function parseChangeSection(content, sectionHeader) {
  const sectionRegex = new RegExp(
    `${sectionHeader}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`
  );
  const match = content.match(sectionRegex);
  if (match && match[1]) {
    return match[1]
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((line) => line.replace(/^- /, "").trim())
      .filter(Boolean);
  }
  return [];
}
