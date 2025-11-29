import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

export async function getCodeExplanation(options) {
  const { code, language, framework, specificFocus } = options;

  const prompt = `You are a Principal QA Automation Engineer with 15+ years of experience mentoring junior engineers. Provide an expert-level code analysis and explanation.

CONTEXT:
- **Language**: ${language}
- **Framework**: ${framework}
- **Focus Area**: ${specificFocus || "Comprehensive analysis"}
- **Audience**: Junior to Mid-level Automation Engineers

ANALYSIS FRAMEWORK:
1. **Functional Understanding**: What the code actually does
2. **Architectural Assessment**: Code structure and design patterns
3. **Quality Evaluation**: Code quality, maintainability, and robustness
4. **Best Practices**: Alignment with industry standards
5. **Learning Opportunities**: Key concepts for skill development

CODE TO ANALYZE:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

RESPONSE FORMAT - Return in this exact structure:

# 🧪 Code Analysis: ${framework} ${language} Test

## 🎯 Executive Summary
[One paragraph - High-level purpose and business value of this test]

## 📋 Test Scenario & User Journey
### Test Objective
- **Primary Goal**: [Main objective]
- **Success Criteria**: [What defines test success]
- **Test Scope**: [What's included/excluded]

### User Workflow
\`\`\`
1. [Step 1 - Specific action with locators]
2. [Step 2 - Specific action with assertions]
3. [Step 3 - Next action]
...
\`\`\`

## 🔍 Technical Deep Dive

### Code Structure Analysis
\`\`\`${language.toLowerCase()}
// Line-by-line or block-by-block analysis with inline comments
${code
  .split("\n")
  .map((line, i) => `Line ${i + 1}: ${line}`)
  .join("\n")}
\`\`\`

### Framework-Specific Patterns
**${framework} Features Used:**
- [Pattern 1 with explanation]
- [Pattern 2 with explanation]
- [Pattern 3 with explanation]

### Selector Strategy Assessment
**Locators Identified:**
- [Selector 1] → Purpose: [What it targets]
- [Selector 2] → Purpose: [What it targets]
- [Selector 3] → Purpose: [What it targets]

**Stability Analysis:** [Evaluate selector robustness]

## ⚡ Advanced Concepts

### Automation Patterns
- **Synchronization**: [How the code handles waits/async operations]
- **Error Handling**: [Exception management strategy]
- **Data Management**: [Test data handling approach]
- **Environment Configuration**: [Any environment-specific logic]

### Performance Considerations
- [Execution efficiency notes]
- [Potential bottlenecks]
- [Resource management]

## 🏆 Best Practices Assessment

### ✅ Strengths
- [What the code does well]
- [Good patterns implemented]
- [Effective solutions]

### 📝 Improvement Opportunities
**Priority: High**
1. **[Critical]**: [Major issue with significant impact]
   - **Problem**: [Description]
   - **Solution**: [Specific fix]
   - **Benefit**: [Expected improvement]

**Priority: Medium**
2. **[Enhancement]**: [Important improvement]
   - **Problem**: [Description]
   - **Solution**: [Specific fix]
   - **Benefit**: [Expected improvement]

**Priority: Low**
3. **[Optimization]**: [Minor refinement]
   - **Problem**: [Description]
   - **Solution**: [Specific fix]
   - **Benefit**: [Expected improvement]

## 🚀 Learning Takeaways
### Key Concepts for Junior Engineers
- **Fundamental**: [Basic concept explained]
- **Intermediate**: [Framework-specific concept]
- **Advanced**: [Complex pattern or technique]

### Recommended Next Steps
1. **Immediate**: [Quick win to implement now]
2. **Short-term**: [Improvement for next sprint]
3. **Long-term**: [Architectural consideration]

## 📚 Additional Resources
- [Relevant documentation links]
- [Related learning materials]
- [Community best practices]

IMPORTANT: 
- Be specific and reference actual code elements
- Provide actionable, practical advice
- Explain "why" not just "what"
- Focus on real-world applicability`;

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
    type: "explainer",
    duration: duration,
  }).catch((err) => console.error("DB save failed:", err));

  return content;
}
