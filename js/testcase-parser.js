/**
 * Parse test cases from API response text
 * @param {string} responseText - The raw response text from the API
 * @returns {Array} Array of parsed test case objects
 */
export function parseTestCases(responseText) {
  if (!responseText || responseText.trim().length === 0) {
    return [];
  }

  const testCases = [];
  const testCaseBlocks = responseText.split(/\*\*Test Case \d+:/);

  // Skip the first element as it's content before the first test case
  for (let i = 1; i < testCaseBlocks.length; i++) {
    const block = testCaseBlocks[i].trim();
    if (!block) continue;

    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    // Extract title from first line
    const title = lines[0]?.replace(/\*\*/g, "").trim() || `Test Case ${i}`;

    // Initialize test case object
    const testCase = {
      id: i,
      title: title,
      type: "functional",
      priority: "Medium",
      description: "",
      steps: [],
      expectedResult: "",
    };

    let currentSection = "";

    // Process remaining lines
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];

      if (line.toLowerCase().startsWith("type:")) {
        testCase.type = line.replace(/type:/i, "").trim().toLowerCase();
      } else if (line.toLowerCase().startsWith("priority:")) {
        testCase.priority = line.replace(/priority:/i, "").trim();
      } else if (line.toLowerCase().startsWith("description:")) {
        testCase.description = line.replace(/description:/i, "").trim();
        currentSection = "description";
      } else if (line.toLowerCase().startsWith("steps:")) {
        currentSection = "steps";
      } else if (line.toLowerCase().startsWith("expected result:")) {
        testCase.expectedResult = line.replace(/expected result:/i, "").trim();
        currentSection = "expectedResult";
      } else if (line.match(/^\d+\./)) {
        // This is a step
        const step = line.replace(/^\d+\.\s*/, "").trim();
        if (step) testCase.steps.push(step);
      } else if (line) {
        // Add to current section
        if (currentSection === "description") {
          testCase.description += " " + line;
        } else if (currentSection === "expectedResult") {
          testCase.expectedResult += " " + line;
        } else if (currentSection === "steps" && testCase.steps.length > 0) {
          // Continue the last step
          testCase.steps[testCase.steps.length - 1] += " " + line;
        }
      }
    }

    // Clean up the text
    testCase.description = testCase.description.trim();
    testCase.expectedResult = testCase.expectedResult.trim();
    testCase.steps = testCase.steps.filter((step) => step.trim().length > 0);

    testCases.push(testCase);
  }

  return testCases;
}

/**
 * Get priority badge class based on priority level
 * @param {string} priority - Priority level (High, Medium, Low)
 * @returns {string} CSS class string
 */
export function getPriorityBadgeClass(priority) {
  if (!priority) return "bg-gray-100 text-gray-700";

  switch (priority.toLowerCase()) {
    case "high":
      return "bg-red-100 text-red-700 border border-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    case "low":
      return "bg-green-100 text-green-700 border border-green-200";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

/**
 * Get test type badge class based on test type
 * @param {string} type - Test type
 * @returns {string} CSS class string
 */
export function getTypeBadgeClass(type) {
  if (!type) return "bg-gray-100 text-gray-700 border border-gray-200";

  switch (type.toLowerCase()) {
    case "functional":
      return "bg-blue-100 text-blue-700 border border-blue-200";
    case "unit":
      return "bg-green-100 text-green-700 border border-green-200";
    case "integration":
      return "bg-purple-100 text-purple-700 border border-purple-200";
    case "e2e":
    case "end-to-end":
      return "bg-indigo-100 text-indigo-700 border border-indigo-200";
    case "api":
      return "bg-orange-100 text-orange-700 border border-orange-200";
    case "security":
      return "bg-red-100 text-red-700 border border-red-200";
    case "performance":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    case "accessibility":
      return "bg-pink-100 text-pink-700 border border-pink-200";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

/**
 * Display test cases in the UI
 * @param {Array} testCases - Array of test case objects
 */
export function displayTestCases(testCases) {
  const testCaseList = document.getElementById("testCaseList");
  const emptyState = document.getElementById("empty-state");
  const totalCountEl = document.getElementById("totalCount");

  if (!testCases || testCases.length === 0) {
    testCaseList.classList.add("hidden");
    emptyState.classList.remove("hidden");
    if (totalCountEl) totalCountEl.textContent = "0";
    return;
  }

  // Hide empty state and show test cases
  emptyState.classList.add("hidden");
  testCaseList.classList.remove("hidden");

  // Update stats
  if (totalCountEl) totalCountEl.textContent = testCases.length;

  // Clear existing content
  testCaseList.innerHTML = "";

  // Generate HTML for each test case
  testCases.forEach((testCase) => {
    const testCaseElement = document.createElement("div");
    testCaseElement.className =
      "test-case-item bg-white/80 backdrop-filter backdrop-blur-lg rounded-xl p-4 border border-slate-200 shadow-sm mb-4";

    testCaseElement.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <h3 class="text-lg font-bold text-slate-800 flex-1">${escapeHtml(
          testCase.title
        )}</h3>
        <div class="flex gap-2 flex-shrink-0">
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${getTypeBadgeClass(
            testCase.type
          )}">
            ${
              testCase.type
                ? testCase.type.charAt(0).toUpperCase() + testCase.type.slice(1)
                : "Functional"
            }
          </span>
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeClass(
            testCase.priority
          )}">
            ${testCase.priority || "Medium"}
          </span>
        </div>
      </div>
      
      ${
        testCase.description
          ? `
        <div class="mb-3">
          <strong class="text-sm font-semibold text-slate-700 block mb-1">Description:</strong>
          <p class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">${escapeHtml(
            testCase.description
          )}</p>
        </div>
      `
          : ""
      }
      
      ${
        testCase.steps && testCase.steps.length > 0
          ? `
        <div class="mb-3">
          <strong class="text-sm font-semibold text-slate-700 block mb-1">Test Steps:</strong>
          <ol class="list-decimal list-inside space-y-1 text-sm text-slate-600 bg-slate-50 rounded-lg p-3 pl-6">
            ${testCase.steps
              .map((step) => `<li class="py-1">${escapeHtml(step)}</li>`)
              .join("")}
          </ol>
        </div>
      `
          : ""
      }
      
      ${
        testCase.expectedResult
          ? `
        <div class="mb-1">
          <strong class="text-sm font-semibold text-slate-700 block mb-1">Expected Result:</strong>
          <p class="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">${escapeHtml(
            testCase.expectedResult
          )}</p>
        </div>
      `
          : ""
      }
    `;

    testCaseList.appendChild(testCaseElement);
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
