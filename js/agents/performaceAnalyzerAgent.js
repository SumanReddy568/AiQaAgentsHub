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
  const firstPaint = metrics.paint?.firstPaint?.toFixed(2) || "N/A";

  const prompt = `You are a senior web performance engineer analyzing page performance data. Provide a comprehensive, actionable performance audit.

CONTEXT:
- URL: ${metrics.url}
- Protocol: ${metrics.security.protocol}
- DOM Complexity: ${metrics.dom?.totalElements || "N/A"} elements

PERFORMANCE METRICS:
• Load Time: ${loadTime}ms
• First Contentful Paint: ${fcp}ms
• First Paint: ${firstPaint}ms  
• Total Resources: ${resourceCount}
• Transfer Size: ${transferSize}KB
• DOM Content Loaded: ${
    metrics.timing.domContentLoadedEvent?.toFixed(2) || "N/A"
  }ms
• Largest Contentful Paint: ${
    metrics.paint?.largestContentfulPaint?.toFixed(2) || "N/A"
  }ms
• Cumulative Layout Shift: ${
    metrics.paint?.cumulativeLayoutShift?.toFixed(4) || "N/A"
  }

RESOURCE BREAKDOWN:
- CSS Files: ${metrics.resources.byType?.css?.count || 0}
- JavaScript Files: ${metrics.resources.byType?.script?.count || 0}
- Image Files: ${metrics.resources.byType?.image?.count || 0}
- Font Files: ${metrics.resources.byType?.font?.count || 0}

ANALYSIS FRAMEWORK:
1. Evaluate against Core Web Vitals thresholds
2. Identify the 2-3 biggest performance bottlenecks
3. Provide specific, prioritized recommendations
4. Estimate potential impact of each optimization

RESPONSE FORMAT - Return in this exact markdown structure:

# Performance Analysis for ${metrics.url}

## 📊 Executive Summary
[Brief overview - 2-3 sentences highlighting the overall performance state and key findings]

## 🎯 Core Web Vitals Assessment
| Metric | Value | Status | Target |
|--------|-------|--------|---------|
| First Contentful Paint | ${fcp}ms | [✅ Good/⚠️ Needs Improvement/❌ Poor] | < 1.8s |
| Largest Contentful Paint | ${
    metrics.paint?.largestContentfulPaint?.toFixed(2) || "N/A"
  }ms | [Status] | < 2.5s |
| Cumulative Layout Shift | ${
    metrics.paint?.cumulativeLayoutShift?.toFixed(4) || "N/A"
  } | [Status] | < 0.1 |

## ⚠️ Critical Issues
[Bulleted list of the top 3 most critical performance problems with specific data points]

## 🚀 Prioritized Recommendations

### High Impact
1. **[Specific actionable recommendation with technical details]**
   - **Expected Impact**: [Estimated improvement]
   - **Effort**: [Low/Medium/High]
   - **How to implement**: [Brief technical guidance]

### Medium Impact  
2. **[Specific recommendation]**
   - **Expected Impact**: [Estimated improvement]
   - **Effort**: [Low/Medium/High]

### Low Impact
3. **[Quick wins or optimizations]**
   - **Expected Impact**: [Estimated improvement]
   - **Effort**: [Low/Medium/High]

## 📈 Performance Score
**Overall Grade**: [A/B/C/D/F] - [Brief justification]

## 🔧 Technical Deep Dive
[Analysis of specific technical metrics and their implications for this page]

## 🎪 Quick Wins
- [List 2-3 immediate actions that can be taken without major refactoring]

IMPORTANT: Be specific, data-driven, and actionable. Reference the actual metric values in your analysis.`;

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
    type: "perf",
    duration,
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}
