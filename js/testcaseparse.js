/**
 * Parse test cases from AI response text
 * @param {string} responseText - The raw response from AI service
 * @returns {Array} Array of parsed test case objects
 */
export function parseTestCases(responseText) {
  const testCases = [];

  // Split by common test case delimiters
  const caseBlocks = responseText
    .split(/(?:Test Case|TC|Test\s*#|\d+\.\s*)/i)
    .filter((block) => block.trim());

  caseBlocks.forEach((block, index) => {
    const testCase = parseTestCaseBlock(block, index + 1);
    if (testCase) {
      testCases.push(testCase);
    }
  });

  return testCases.length > 0 ? testCases : parseAsJson(responseText);
}

/**
 * Parse individual test case block
 */
function parseTestCaseBlock(block, index) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);
  if (lines.length === 0) return null;

  const testCase = {
    id: `TC-${String(index).padStart(3, "0")}`,
    title:
      extractField(block, ["Title", "Name", "Summary"]) ||
      lines[0] ||
      `Test Case ${index}`,
    type: extractField(block, ["Type", "Category"]) || "Functional",
    priority: extractField(block, ["Priority", "Severity"]) || "Medium",
    description:
      extractField(block, ["Description", "Purpose", "Objective"]) || "",
    steps: extractSteps(block) || [],
    expectedResult:
      extractField(block, [
        "Expected Result",
        "Expected Output",
        "Expected Behavior",
      ]) || "",
  };

  return testCase;
}

/**
 * Extract field value from text using keywords
 */
function extractField(text, keywords) {
  for (const keyword of keywords) {
    const regex = new RegExp(`${keyword}\\s*[:=]\\s*([^\\n]+)`, "i");
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

/**
 * Extract steps from test case block
 */
function extractSteps(text) {
  const stepsMatch = text.match(
    /(?:Steps?|Procedure)[\s:]*([^]*?)(?=Expected|Actual|Result|$)/i
  );
  if (!stepsMatch) return [];

  const stepsText = stepsMatch[1];
  const steps = stepsText
    .split(/\n|\d+\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s && s.length > 5);

  return steps.slice(0, 10);
}

/**
 * Fallback: Parse as JSON if structured format
 */
function parseAsJson(responseText) {
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const items = Array.isArray(parsed) ? parsed : parsed.testCases || [];
      return items.map((item, index) => ({
        id: item.id || `TC-${String(index + 1).padStart(3, "0")}`,
        title: item.title || item.name || `Test Case ${index + 1}`,
        type: item.type || item.category || "Functional",
        priority: item.priority || item.severity || "Medium",
        description: item.description || item.purpose || "",
        steps: Array.isArray(item.steps)
          ? item.steps
          : item.steps
          ? [item.steps]
          : [],
        expectedResult:
          item.expectedResult || item.expected_result || item.expected || "",
      }));
    }
  } catch (e) {
    console.warn("Could not parse as JSON:", e);
  }
  return [];
}

/**
 * Display test cases in the DOM
 * @param {Array} testCases - Array of test case objects
 */
export function displayTestCases(testCases) {
  const testCaseList = document.getElementById("testCaseList");

  if (!testCases || testCases.length === 0) {
    testCaseList.innerHTML =
      '<div class="text-center py-8 text-slate-400">No test cases generated</div>';
    return;
  }

  const html = testCases
    .map(
      (tc, index) => `
      <div class="bg-white/80 backdrop-filter backdrop-blur-lg rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">${escapeHtml(
              tc.title
            )}</h3>
            <div class="flex gap-2 mt-2">
              <span class="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">${escapeHtml(
                tc.type
              )}</span>
              <span class="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">${escapeHtml(
                tc.priority
              )}</span>
              <span class="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">${escapeHtml(
                tc.id
              )}</span>
            </div>
          </div>
        </div>
        
        ${
          tc.description
            ? `
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-slate-600 mb-1">Description</h4>
            <p class="text-sm text-slate-700">${escapeHtml(tc.description)}</p>
          </div>
        `
            : ""
        }
        
        ${
          tc.steps && tc.steps.length > 0
            ? `
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-slate-600 mb-2">Steps</h4>
            <ol class="list-decimal list-inside space-y-1">
              ${tc.steps
                .map(
                  (step) =>
                    `<li class="text-sm text-slate-700">${escapeHtml(
                      step
                    )}</li>`
                )
                .join("")}
            </ol>
          </div>
        `
            : ""
        }
        
        ${
          tc.expectedResult
            ? `
          <div>
            <h4 class="text-sm font-semibold text-slate-600 mb-1">Expected Result</h4>
            <p class="text-sm text-slate-700">${escapeHtml(
              tc.expectedResult
            )}</p>
          </div>
        `
            : ""
        }
      </div>
    `
    )
    .join("");

  testCaseList.innerHTML = html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
