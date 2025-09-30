// js/dashboard.js

import { initDB, getAllApiCalls, clearAllData } from './db.js';

let usageChart = null; // To hold the chart instance

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadAndRenderData();
        document.getElementById('clear-data-btn').addEventListener('click', handleClearData);
    } catch (error) {
        console.error("Failed to initialize dashboard:", error);
        document.body.innerHTML = '<p class="text-red-500 text-center p-8">Could not load usage data.</p>';
    }
});

async function loadAndRenderData() {
    const records = await getAllApiCalls();
    renderDashboard(records);
}

async function handleClearData() {
    const isConfirmed = window.confirm("Are you sure you want to delete all usage history? This action cannot be undone.");
    if (isConfirmed) {
        await clearAllData();
        await loadAndRenderData(); // Re-render the empty dashboard
    }
}

/**
 * Calculates the 90th percentile for a given array of numbers.
 * @param {number[]} durations - Array of response times in milliseconds.
 * @returns {number} The P90 value.
 */
function calculateP90(durations) {
    if (!durations || durations.length === 0) return 0;

    // Filter out any invalid data points from old records
    const validDurations = durations.filter(d => typeof d === 'number' && d >= 0);
    if (validDurations.length === 0) return 0;

    // Sort durations in ascending order
    validDurations.sort((a, b) => a - b);

    // Find the index at the 90th percentile
    const index = Math.ceil(0.9 * validDurations.length) - 1;
    return Math.round(validDurations[index]);
} // <-- This closing brace was missing

function renderDashboard(records = []) {
    // --- 1. Calculate Statistics ---
    const totalCalls = records.length;
    const totalTokens = records.reduce((sum, rec) => sum + (rec.totalTokens || 0), 0);
    const locatorCalls = records.filter(r => r.type === 'locator').length;
    const chatCalls = records.filter(r => r.type === 'chat').length;
    const explainerCalls = records.filter(r => r.type === 'explainer').length;
    const optimizerCalls = records.filter(r => r.type === 'optimizer').length;
    const avgTokens = totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0;
    const estimatedCost = (totalTokens / 1_000_000) * 1.00;

    // --- 2. Update Stat Cards ---
    document.getElementById('total-calls').textContent = totalCalls.toLocaleString();
    document.getElementById('total-tokens').textContent = totalTokens.toLocaleString();
    document.getElementById('locator-calls').textContent = locatorCalls.toLocaleString();
    document.getElementById('chat-calls').textContent = chatCalls.toLocaleString();
    document.getElementById('explainer-calls').textContent = explainerCalls.toLocaleString();
    document.getElementById('optimizer-calls').textContent = optimizerCalls.toLocaleString();
    document.getElementById('avg-tokens').textContent = avgTokens.toLocaleString();
    document.getElementById('estimated-cost').textContent = `$${estimatedCost.toFixed(4)}`;

    // --- 3. Process Data for Model Stats Table and Chart ---
    const modelStats = records.reduce((acc, rec) => {
        const model = rec.model || 'unknown';
        if (!acc[model]) {
            acc[model] = { calls: 0, tokens: 0 };
        }
        acc[model].calls++;
        acc[model].tokens += rec.totalTokens || 0;
        return acc;
    }, {});

    // --- 4. Populate the Model Stats Data Table ---
    const modelTableBody = document.getElementById('model-stats-body');
    if (Object.keys(modelStats).length === 0) {
        modelTableBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-500">No usage data recorded yet.</td></tr>`;
    } else {
        modelTableBody.innerHTML = Object.entries(modelStats).map(([modelName, stats]) => `
            <tr class="border-b border-slate-200/50 last:border-b-0">
                <td class="p-3 font-medium text-slate-800">${modelName}</td>
                <td class="p-3 text-slate-700">${stats.calls.toLocaleString()}</td>
                <td class="p-3 text-slate-700">${stats.tokens.toLocaleString()}</td>
            </tr>`
        ).join('');
    }

    // --- 5. Render the Model Usage Chart ---
    const ctx = document.getElementById('model-usage-chart').getContext('2d');
    if (usageChart) {
        usageChart.destroy();
    }
    usageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(modelStats),
            datasets: [{
                label: 'Total Tokens Used',
                data: Object.values(modelStats).map(s => s.tokens),
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw.toLocaleString()}` } }
            }
        }
    });

    // --- 6. Populate the Agent Performance Table ---
    const agentTypes = ['locator', 'chat', 'explainer', 'optimizer'];
    const perfTableBody = document.getElementById('agent-performance-body');
    if (records.length === 0) {
        perfTableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-500 dark:text-slate-400">No performance data yet.</td></tr>`;
    } else {
        const perfHtml = agentTypes.map(type => {
            const agentRecords = records.filter(r => r.type === type);
            const callCount = agentRecords.length;
            const durations = agentRecords.map(r => r.duration);
            const p90 = calculateP90(durations);
            const agentName = type.charAt(0).toUpperCase() + type.slice(1);

            return `
                <tr class="border-b border-slate-200/80 dark:border-slate-700/60 last:border-b-0">
                    <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${agentName}</td>
                    <td class="p-3 text-slate-700 dark:text-slate-300">${callCount.toLocaleString()}</td>
                    <td class="p-3 text-slate-700 dark:text-slate-300">${p90 > 0 ? p90.toLocaleString() : 'N/A'}</td>
                </tr>
            `;
        }).join('');
        perfTableBody.innerHTML = perfHtml;
    }
}
