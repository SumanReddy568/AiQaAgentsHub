import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

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
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: 0,
    type: "diff",
    duration,
  }).catch((err) => console.error("DB save failed:", err));

  // Parse out diff and summary
  let diff = "",
    summary = "";
  if (content) {
    console.log("Raw API response:", content);

    // More robust regex that handles empty diffs better
    const diffMatch = content.match(/```diff\s*([\s\S]*?)```/);

    if (diffMatch) {
      diff = diffMatch[1].trim();
      // If diff is just the file headers with no actual differences, set a clearer message
      if (diff.match(/^---.*\n\+\+\+.*$/) && !diff.includes("@@ ")) {
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
      summary = content.replace(/## Diff\s*```diff[\s\S]*?```/g, "").trim();
    }
  } else {
    summary =
      "The AI returned an empty response. Please check your API key and model configuration.";
  }

  return { diff, summary };
}
