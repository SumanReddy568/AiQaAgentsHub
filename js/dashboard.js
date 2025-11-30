// js/dashboard.js

import { initDB, getAllApiCalls, clearAllData } from "./db.js";

let usageChart = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initDB();
    await loadAndRenderData();
    document
      .getElementById("clear-data-btn")
      .addEventListener("click", handleClearData);
  } catch (error) {
    console.error("Failed to initialize dashboard:", error);
    document.body.innerHTML =
      '<p class="text-red-500 text-center p-8">Could not load usage data.</p>';
  }
});

async function loadAndRenderData() {
  const records = await getAllApiCalls();
  renderDashboard(records);
}

async function handleClearData() {
  const isConfirmed = window.confirm(
    "Are you sure you want to delete all usage history? This action cannot be undone."
  );
  if (isConfirmed) {
    await clearAllData();
    await loadAndRenderData();
  }
}

function renderDashboard(records = []) {
  // --- 1. Process Data for Model Stats Table and Chart ---
  const modelStats = records.reduce((acc, rec) => {
    const model = rec.model || "unknown";
    if (!acc[model]) {
      acc[model] = { calls: 0, tokens: 0 };
    }
    acc[model].calls++;

    // Fix token counting for model stats with multiple field checks
    const promptTokens =
      rec.promptTokens || rec.prompt_tokens || rec.usage?.prompt_tokens || 0;
    const responseTokens =
      rec.responseTokens ||
      rec.completion_tokens ||
      rec.response_tokens ||
      rec.usage?.completion_tokens ||
      0;
    const totalFromRecord =
      rec.totalTokens ||
      rec.total_tokens ||
      rec.usage?.total_tokens ||
      promptTokens + responseTokens;
    acc[model].tokens += totalFromRecord;

    return acc;
  }, {});

  // --- 2. Populate the Model Stats Data Table and Chart ---
  const modelTableBody = document.getElementById("model-stats-body");
  if (modelTableBody) {
    if (Object.keys(modelStats).length === 0) {
      modelTableBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-500">No usage data recorded yet.</td></tr>`;
    } else {
      modelTableBody.innerHTML = Object.entries(modelStats)
        .map(
          ([modelName, stats]) => `
                <tr class="border-b border-slate-200/50 last:border-b-0">
                    <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${modelName}</td>
                    <td class="p-3 text-slate-700 dark:text-slate-300">${stats.calls.toLocaleString()}</td>
                    <td class="p-3 text-slate-700 dark:text-slate-300">${stats.tokens.toLocaleString()}</td>
                </tr>`
        )
        .join("");
    }
  }

  // --- 3. Render the Model Usage Chart ---
  const ctx = document.getElementById("model-usage-chart")?.getContext("2d");
  if (!ctx) return;

  if (usageChart) {
    usageChart.destroy();
  }
  usageChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels:
        Object.keys(modelStats).length > 0
          ? Object.keys(modelStats)
          : ["No Data"],
      datasets: [
        {
          label: "Total Tokens Used",
          data:
            Object.keys(modelStats).length > 0
              ? Object.values(modelStats).map((s) => s.tokens)
              : [0],
          backgroundColor: "rgba(79, 70, 229, 0.8)",
          borderColor: "rgba(79, 70, 229, 1)",
          borderWidth: 1,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.1)" },
          ticks: { color: "#cbd5e1" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#cbd5e1" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${context.raw.toLocaleString()}`,
          },
        },
      },
    },
  });

  // --- 4. Render Recent API Calls Table ---
  renderRecentCallsTable(records);
}

function renderRecentCallsTable(records = []) {
  const recentCallsBody = document.getElementById("recent-calls-body");
  if (!recentCallsBody) return;

  // Get last 10 records in reverse chronological order
  const recentCalls = records
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 10);

  if (recentCalls.length === 0) {
    recentCallsBody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-slate-500">No API calls recorded yet.</td></tr>`;
    return;
  }

  recentCallsBody.innerHTML = recentCalls
    .map((record) => {
      const agentType = record.type || "unknown";
      const model = record.model || "unknown";
      const tokens = record.totalTokens || record.tokensUsed || 0;
      const responseTime = record.duration || 0;
      const timestamp = record.timestamp
        ? new Date(record.timestamp).toLocaleString()
        : "N/A";

      // Input/output token size
      const inputTokens =
        record.promptTokens ||
        record.prompt_tokens ||
        (record.usage?.prompt_tokens ?? 0);
      const outputTokens =
        record.responseTokens ||
        record.completion_tokens ||
        record.response_tokens ||
        (record.usage?.completion_tokens ?? 0);

      return `
        <tr class="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
          <td class="p-3 font-medium text-slate-800 dark:text-slate-200">
            <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-semibold">
              ${agentType}
            </span>
          </td>
          <td class="p-3 text-slate-700 dark:text-slate-300 text-xs">${model}</td>
          <td class="p-3 text-slate-700 dark:text-slate-300 font-mono text-xs">${tokens.toLocaleString()}</td>
          <td class="p-3 text-slate-700 dark:text-slate-300 text-xs">${responseTime}ms</td>
          <td class="p-3 text-slate-600 dark:text-slate-400 text-xs font-mono">${inputTokens.toLocaleString()}</td>
          <td class="p-3 text-slate-600 dark:text-slate-400 text-xs font-mono">${outputTokens.toLocaleString()}</td>
          <td class="p-3 text-slate-500 dark:text-slate-500 text-xs whitespace-nowrap">${timestamp}</td>
        </tr>`;
    })
    .join("");
}

function truncateText(text, maxLength = 50) {
  if (!text) return "—";
  if (typeof text !== "string") return "—";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
