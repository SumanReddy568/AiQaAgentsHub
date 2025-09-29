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

function renderDashboard(records = []) {
    // --- 1. Calculate Statistics ---
    const totalCalls = records.length;
    const totalTokens = records.reduce((sum, rec) => sum + (rec.totalTokens || 0), 0);

    // UPDATED: Calculate stats for all three call types
    const locatorCalls = records.filter(r => r.type === 'locator').length;
    const chatCalls = records.filter(r => r.type === 'chat').length;
    const explainerCalls = records.filter(r => r.type === 'explainer').length;

    const avgTokens = totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0;
    const estimatedCost = (totalTokens / 1_000_000) * 1.00;

    // --- 2. Update Stat Cards ---
    document.getElementById('total-calls').textContent = totalCalls.toLocaleString();
    document.getElementById('total-tokens').textContent = totalTokens.toLocaleString();

    // UPDATED: Find and update all three call type elements
    const locatorCallsEl = document.getElementById('locator-calls');
    const chatCallsEl = document.getElementById('chat-calls');
    const explainerCallsEl = document.getElementById('explainer-calls'); // New element

    if (locatorCallsEl) locatorCallsEl.textContent = locatorCalls.toLocaleString();
    if (chatCallsEl) chatCallsEl.textContent = chatCalls.toLocaleString();
    if (explainerCallsEl) explainerCallsEl.textContent = explainerCalls.toLocaleString();

    document.getElementById('avg-tokens').textContent = avgTokens.toLocaleString();
    document.getElementById('estimated-cost').textContent = `$${estimatedCost.toFixed(4)}`;

    // --- 3. Process Data for Table and Chart ---
    const modelStats = records.reduce((acc, rec) => {
        const model = rec.model || 'unknown';
        if (!acc[model]) {
            acc[model] = { calls: 0, tokens: 0 };
        }
        acc[model].calls++;
        acc[model].tokens += rec.totalTokens || 0;
        return acc;
    }, {});

    // --- 4. Populate the Data Table ---
    const tableBody = document.getElementById('model-stats-body');
    tableBody.innerHTML = '';
    if (Object.keys(modelStats).length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-500">No usage data recorded yet.</td></tr>`;
    } else {
        for (const modelName in modelStats) {
            const stats = modelStats[modelName];
            tableBody.innerHTML += `<tr class="border-b border-slate-200/50 last:border-b-0">
                <td class="p-3 font-medium text-slate-800">${modelName}</td>
                <td class="p-3 text-slate-700">${stats.calls.toLocaleString()}</td>
                <td class="p-3 text-slate-700">${stats.tokens.toLocaleString()}</td>
            </tr>`;
        }
    }

    // --- 5. Render the Chart ---
    const ctx = document.getElementById('model-usage-chart').getContext('2d');
    const chartData = {
        labels: Object.keys(modelStats),
        datasets: [{
            label: 'Total Tokens Used',
            data: Object.values(modelStats).map(s => s.tokens),
            backgroundColor: 'rgba(79, 70, 229, 0.8)',
            borderColor: 'rgba(79, 70, 229, 1)',
            borderWidth: 1,
            borderRadius: 5,
        }]
    };

    if (usageChart) {
        usageChart.destroy(); // Destroy old chart instance before creating a new one
    }

    usageChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw.toLocaleString()}`
                    }
                }
            }
        }
    });
}