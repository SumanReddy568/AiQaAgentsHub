import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

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
  const fcp = metrics.paint?.firstContentfulPaint?.toFixed(2) || "N/A";

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
        - **First Paint**: ${metrics.paint?.firstPaint?.toFixed(2) || "N/A"}ms
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
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    type: "perf",
    duration,
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}