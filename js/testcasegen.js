import { addApiCall, initDB } from "./db.js";
import { getTestCaseResponse } from "./agents/testCaseAgent.js";
import {
  parseMultipleFiles,
  combineFileContents,
  formatFileSize,
} from "./fileParser.js";
import { loadSettingsFromStorage, initSettings } from "./settings.js";
import { state } from "./state.js";
import { parseTestCases, displayTestCases } from "./testcase-parser.js";

// Initialize settings on load
loadSettingsFromStorage();
initSettings();

function showNotification(message, type = "info") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    alert(message);
    return;
  }

  const toast = document.createElement("div");
  const typeClasses = {
    success: "bg-green-100 border-green-500 text-green-700",
    error: "bg-red-100 border-red-500 text-red-700",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-700",
    info: "bg-blue-100 border-blue-500 text-blue-700",
  };

  toast.className = `px-4 py-3 rounded-lg border shadow-lg transform transition-all duration-300 ease-in-out ${
    typeClasses[type] || typeClasses["info"]
  }`;
  toast.textContent = message;
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px)";

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// DOM Elements
const fileUploadArea = document.getElementById("fileUploadArea");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const testTypeSelect = document.getElementById("testType");
const additionalDetailsTextarea = document.getElementById("additionalDetails");
const generateBtn = document.getElementById("generateBtn");
const testCaseList = document.getElementById("testCaseList");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const emptyState = document.getElementById("empty-state");

// State
let uploadedFiles = [];
let generatedTestCases = [];
let currentTokens = 0;
let currentCost = 0;

// Event Listeners
fileUploadArea.addEventListener("click", (e) => {
  if (e.target.closest("#fileList")) return;
  fileInput.click();
});

fileInput.addEventListener("change", handleFileSelect);
fileUploadArea.addEventListener("dragover", handleDragOver);
fileUploadArea.addEventListener("dragleave", handleDragLeave);
fileUploadArea.addEventListener("drop", handleDrop);
generateBtn.addEventListener("click", handleGenerate);
exportCsvBtn.addEventListener("click", exportAsCsv);
exportJsonBtn.addEventListener("click", exportAsJson);

// File Upload Handlers
function handleDragOver(e) {
  e.preventDefault();
  fileUploadArea.classList.add("dragover");
}

function handleDragLeave(e) {
  e.preventDefault();
  fileUploadArea.classList.remove("dragover");
}

function handleDrop(e) {
  e.preventDefault();
  fileUploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  processFiles(files);
}

function handleFileSelect(e) {
  const files = e.target.files;
  processFiles(files);
}

async function processFiles(files) {
  if (files.length === 0) return;

  showNotification(`Processing ${files.length} file(s)...`, "info");

  try {
    const parsedFiles = await parseMultipleFiles(files);
    uploadedFiles = [...uploadedFiles, ...parsedFiles];
    displayFileList();

    const successCount = parsedFiles.filter((f) => f.success).length;
    const failCount = parsedFiles.length - successCount;

    if (failCount > 0) {
      showNotification(
        `Loaded ${successCount} file(s), ${failCount} failed.`,
        "warning"
      );
    } else {
      showNotification(
        `Successfully loaded ${successCount} file(s).`,
        "success"
      );
    }
  } catch (error) {
    showNotification("An error occurred during file parsing.", "error");
    console.error(error);
  }
}

function displayFileList() {
  if (uploadedFiles.length === 0) {
    fileList.innerHTML = "";
    return;
  }

  fileList.innerHTML = uploadedFiles
    .map(
      (file, index) => `
    <div class="flex items-center justify-between bg-white/80 backdrop-filter backdrop-blur-lg rounded-xl px-4 py-3 border border-slate-200 shadow-sm">
      <div class="flex items-center space-x-3">
        <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="text-sm font-medium text-slate-800">${file.name}</p>
          <p class="text-xs text-slate-500">${formatFileSize(file.size)} • ${
        file.success ? "Ready" : "Error"
      }</p>
        </div>
      </div>
      <button onclick="removeFile(${index})" class="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `
    )
    .join("");
}

window.removeFile = function (index) {
  uploadedFiles.splice(index, 1);
  displayFileList();
  showNotification("File removed", "success");
};

// Fallback function to display test cases if parser doesn't handle it
function fallbackDisplayTestCases(testCases) {
  if (!testCases || testCases.length === 0) {
    testCaseList.innerHTML =
      '<div class="text-center py-8 text-slate-400">No test cases found in the response</div>';
    emptyState.classList.remove("hidden");
    testCaseList.classList.add("hidden");
    return;
  }

  testCaseList.innerHTML = testCases
    .map(
      (tc, index) => `
    <div class="test-case-item">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="text-lg font-semibold text-slate-800">${
            tc.title || `Test Case ${index + 1}`
          }</h3>
          <div class="flex gap-2 mt-1">
            <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">${
              tc.type || "N/A"
            }</span>
            <span class="px-2 py-1 text-xs font-medium rounded-full ${
              tc.priority === "High"
                ? "bg-red-100 text-red-700"
                : tc.priority === "Medium"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
            }">${tc.priority || "N/A"}</span>
          </div>
        </div>
        <span class="text-sm font-medium text-slate-500">TC-${
          tc.id || index + 1
        }</span>
      </div>
      
      ${
        tc.description
          ? `
      <div class="mb-3">
        <h4 class="text-sm font-semibold text-slate-700 mb-1">Description:</h4>
        <p class="text-sm text-slate-600">${tc.description}</p>
      </div>
      `
          : ""
      }
      
      ${
        tc.steps && tc.steps.length > 0
          ? `
      <div class="mb-3">
        <h4 class="text-sm font-semibold text-slate-700 mb-2">Steps:</h4>
        <ol class="list-decimal list-inside space-y-1">
          ${tc.steps
            .map((step) => `<li class="text-sm text-slate-600">${step}</li>`)
            .join("")}
        </ol>
      </div>
      `
          : ""
      }
      
      ${
        tc.expectedResult
          ? `
      <div class="mb-3">
        <h4 class="text-sm font-semibold text-slate-700 mb-1">Expected Result:</h4>
        <p class="text-sm text-slate-600">${tc.expectedResult}</p>
      </div>
      `
          : ""
      }
      
      <div class="flex gap-2 mt-3 pt-3 border-t border-slate-200">
        <button onclick="copyTestCase(${index})" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Copy
        </button>
      </div>
    </div>
  `
    )
    .join("");

  emptyState.classList.add("hidden");
  testCaseList.classList.remove("hidden");
}

// Copy single test case
window.copyTestCase = function (index) {
  if (!generatedTestCases[index]) return;

  const tc = generatedTestCases[index];
  const text = `
Test Case: ${tc.title}
Type: ${tc.type}
Priority: ${tc.priority}
Description: ${tc.description}
Steps:
${tc.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}
Expected Result: ${tc.expectedResult}
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showNotification("Test case copied to clipboard", "success");
  });
};

// Copy all test cases
const copyAllBtn = document.getElementById("copyAllBtn");
if (copyAllBtn) {
  copyAllBtn.addEventListener("click", () => {
    if (!generatedTestCases || generatedTestCases.length === 0) {
      showNotification("No test cases to copy", "error");
      return;
    }

    const allText = generatedTestCases
      .map(
        (tc, i) => `
Test Case ${i + 1}: ${tc.title}
Type: ${tc.type}
Priority: ${tc.priority}
Description: ${tc.description}
Steps:
${tc.steps.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}
Expected Result: ${tc.expectedResult}
    `
      )
      .join("\n\n---\n\n");

    navigator.clipboard.writeText(allText).then(() => {
      showNotification("All test cases copied to clipboard", "success");
    });
  });
}

function updateStats(count) {
  // Only update export buttons state
  exportCsvBtn.disabled = count === 0;
  exportJsonBtn.disabled = count === 0;

  // Optional: Update copy all button if it exists
  const copyAllBtn = document.getElementById("copyAllBtn");
  if (copyAllBtn) {
    copyAllBtn.disabled = count === 0;
  }
}

// Main Generation Function
async function handleGenerate() {
  if (!state.apiKey) {
    showNotification(
      "API key not configured. Please add it in Settings.",
      "error"
    );
    return;
  }

  if (uploadedFiles.length === 0) {
    showNotification("Please upload at least one file", "error");
    return;
  }

  const testType = testTypeSelect.value;
  const additionalDetails = additionalDetailsTextarea.value.trim();

  generateBtn.disabled = true;
  generateBtn.innerHTML = `
    <span class="flex items-center justify-center space-x-2">
      <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Generating...</span>
    </span>
  `;

  emptyState.classList.add("hidden");
  testCaseList.innerHTML =
    '<div class="text-center py-8 text-slate-400">Generating test cases...</div>';
  testCaseList.classList.remove("hidden");

  try {
    const combinedContent = combineFileContents(uploadedFiles);
    const response = await getTestCaseResponse(
      combinedContent,
      testType,
      additionalDetails
    );

    console.log("Full API Response:", response);

    // Extract response text from the 'content' property of the response object
    let responseText = response.content || "";

    console.log("Response content length:", responseText.length);
    console.log("Response content preview:", responseText.substring(0, 200));

    // Parse and display test cases using the parser
    let parsedCases = parseTestCases(responseText);
    generatedTestCases = parsedCases;
    console.log("Parsed test cases:", generatedTestCases);

    // Display test cases - try parser first, fallback if needed
    if (typeof displayTestCases === "function") {
      try {
        displayTestCases(generatedTestCases);
      } catch (error) {
        console.warn("Parser display failed, using fallback:", error);
        fallbackDisplayTestCases(generatedTestCases);
      }
    } else {
      fallbackDisplayTestCases(generatedTestCases);
    }

    // Get token information (supporting multiple usage field names)
    const tokensUsed =
      response.usage?.totalTokenCount ||
      response.usage?.total_tokens ||
      response.usage?.totalTokens ||
      0;
    const cost = (tokensUsed / 1000) * 0.001;

    currentTokens = tokensUsed;
    currentCost = cost;

    // The agent now handles logging, so this is removed to prevent double counting.
    /*
    await initDB();
    await addApiCall({
      timestamp: Date.now(),
      model: state.selectedModel || "gemini-2.5-flash",
      totalTokens: tokensUsed,
      type: "testcasegen",
      locatorsGenerated: generatedTestCases.length,
    });
    */

    updateStats(generatedTestCases.length);

    showNotification(
      `Generated ${generatedTestCases.length} test cases!`,
      "success"
    );
  } catch (error) {
    console.error("Generation error:", error);
    testCaseList.innerHTML = `
      <div class="text-center py-8 text-red-400">
        <p class="font-semibold mb-2">Error generating test cases</p>
        <p class="text-sm">${error.message}</p>
      </div>
    `;
    showNotification("Generation failed: " + error.message, "error");
    emptyState.classList.remove("hidden");
    testCaseList.classList.add("hidden");
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <span class="flex items-center justify-center space-x-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"></polygon>
        </svg>
        <span>Generate Test Cases</span>
      </span>
    `;
  }
}

// Export Functions
function exportAsCsv() {
  if (!generatedTestCases || generatedTestCases.length === 0) {
    showNotification("No test cases to export", "error");
    return;
  }

  const headers = [
    "ID",
    "Title",
    "Type",
    "Priority",
    "Description",
    "Steps",
    "Expected Result",
  ];
  const csvContent = [
    headers.join(","),
    ...generatedTestCases.map((tc) =>
      [
        tc.id,
        `"${tc.title.replace(/"/g, '""')}"`,
        tc.type,
        tc.priority,
        `"${tc.description.replace(/"/g, '""')}"`,
        `"${tc.steps.join("; ").replace(/"/g, '""')}"`,
        `"${tc.expectedResult.replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, "test-cases.csv", "text/csv");
  showNotification("Exported as CSV", "success");
}

function exportAsJson() {
  if (!generatedTestCases || generatedTestCases.length === 0) {
    showNotification("No test cases to export", "error");
    return;
  }

  const data = {
    generatedAt: new Date().toISOString(),
    provider: state.provider,
    model: state.selectedModel,
    testType: testTypeSelect.value,
    testCases: generatedTestCases,
    tokensUsed: currentTokens,
    estimatedCost: currentCost,
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, "test-cases.json", "application/json");
  showNotification("Exported as JSON", "success");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
