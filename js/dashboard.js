// js/dashboard.js

import { initDB, getAllApiCalls, clearAllData } from './db.js';

let usageChart = null;
let sparklineCharts = {};
let performanceChart = null;
let timelineChart = null;
let tokenChart = null;
let responseTimeChart = null;

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
    // console.log('📊 All Records from DB:', records);
    // console.log('📊 First 3 records detail:', records.slice(0, 3));
    renderDashboard(records);
}

async function handleClearData() {
    const isConfirmed = window.confirm("Are you sure you want to delete all usage history? This action cannot be undone.");
    if (isConfirmed) {
        await clearAllData();
        await loadAndRenderData();
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
}

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                font: { family: 'Inter', size: 12 }
            }
        },
        tooltip: {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary'),
            titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
            bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color'),
            borderWidth: 1
        }
    },
    scales: {
        x: {
            ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') },
            grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') }
        },
        y: {
            ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') },
            grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') }
        }
    }
};

// Sparkline chart creator
function createSparkline(canvasId, data, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Destroy existing chart if it exists
    if (sparklineCharts[canvasId]) {
        sparklineCharts[canvasId].destroy();
    }

    // Ensure we have valid data array
    const chartData = Array.isArray(data) && data.length > 0 ? data : [0, 0, 0, 0, 0];

    sparklineCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map((_, i) => i),
            datasets: [{
                data: chartData,
                borderColor: color,
                backgroundColor: `${color}20`,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, beginAtZero: true }
            }
        }
    });

    return sparklineCharts[canvasId];
}

// Performance spike chart - Agent-wise instead of call-wise
function createPerformanceSpikeChart(records) {
    const ctx = document.getElementById('performance-spike-chart');
    if (!ctx) return;

    if (performanceChart) performanceChart.destroy();

    const agentTypes = ['locator', 'chat', 'explainer', 'optimizer', 'diff', 'perf'];
    const agentColors = {
        locator: '#22c55e',
        chat: '#ec4899',
        explainer: '#6366f1',
        optimizer: '#84cc16',
        diff: '#14b8a6'
    };

    // Calculate average and max response times per agent
    const avgTimes = [];
    const maxTimes = [];
    const labels = [];

    agentTypes.forEach(type => {
        const agentRecords = records.filter(r => r.type === type);
        if (agentRecords.length > 0) {
            const durations = agentRecords.map(r => r.duration || 0);
            const avg = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
            const max = Math.max(...durations);

            avgTimes.push(avg);
            maxTimes.push(max);
            labels.push(type.charAt(0).toUpperCase() + type.slice(1));
        }
    });

    // If no data, show empty state
    if (labels.length === 0) {
        labels.push('No Data');
        avgTimes.push(0);
        maxTimes.push(0);
    }

    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Average Response Time (ms)',
                    data: avgTimes,
                    backgroundColor: labels.map((label, i) => {
                        const type = agentTypes[i];
                        return type ? `${agentColors[type]}80` : '#94a3b8';
                    }),
                    borderColor: labels.map((label, i) => {
                        const type = agentTypes[i];
                        return type ? agentColors[type] : '#64748b';
                    }),
                    borderWidth: 2,
                    borderRadius: 6
                },
                {
                    label: 'Max Response Time (ms)',
                    data: maxTimes,
                    backgroundColor: labels.map((label, i) => {
                        const type = agentTypes[i];
                        const baseColor = type ? agentColors[type] : '#94a3b8';
                        return `${baseColor}40`;
                    }),
                    borderColor: labels.map((label, i) => {
                        const type = agentTypes[i];
                        return type ? agentColors[type] : '#64748b';
                    }),
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: {
                    ...chartDefaults.plugins.legend,
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} ms`;
                        }
                    }
                }
            },
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Response Time (ms)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                    }
                }
            }
        }
    });
}

// Calls timeline chart
function createCallsTimelineChart(records) {
    const ctx = document.getElementById('calls-timeline-chart');
    if (!ctx) return;

    if (timelineChart) timelineChart.destroy();

    const agentTypes = ['locator', 'chat', 'explainer', 'optimizer', 'diff', 'perf'];
    const colors = {
        locator: '#22c55e',
        chat: '#ec4899',
        explainer: '#6366f1',
        optimizer: '#84cc16',
        diff: '#14b8a6'
    };

    // Group by day (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const datasets = agentTypes.map(type => {
        const typeRecords = records.filter(r => r.type === type);
        const dailyCounts = Array(7).fill(0);

        typeRecords.forEach(record => {
            const recordDate = new Date(record.timestamp);
            const dayIndex = Math.floor((Date.now() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
            if (dayIndex >= 0 && dayIndex < 7) {
                dailyCounts[6 - dayIndex]++;
            }
        });

        return {
            label: type.charAt(0).toUpperCase() + type.slice(1),
            data: dailyCounts,
            borderColor: colors[type],
            backgroundColor: `${colors[type]}20`,
            borderWidth: 2,
            tension: 0.4,
            fill: true
        };
    });

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: datasets
        },
        options: chartDefaults
    });
}

// Token analysis chart
function createTokenAnalysisChart(records) {
    const ctx = document.getElementById('token-analysis-chart');
    if (!ctx) return;

    if (tokenChart) tokenChart.destroy();

    const agentTypes = ['locator', 'chat', 'explainer', 'optimizer', 'diff', 'perf'];
    const inputTokens = [];
    const outputTokens = [];

    agentTypes.forEach(type => {
        const typeRecords = records.filter(r => r.type === type);
        let totalInput = 0;
        let totalOutput = 0;

        typeRecords.forEach(r => {
            // Robustly extract input tokens
            const promptTokens = r.promptTokens || r.prompt_tokens || r.usage?.prompt_tokens || 0;
            // Robustly extract output tokens
            const responseTokens = r.responseTokens || r.completion_tokens || r.response_tokens || r.usage?.completion_tokens || 0;
            // If only totalTokens is present, split as input:output = 50:50 (fallback)
            const totalTokens = r.totalTokens || r.total_tokens || r.usage?.total_tokens || 0;
            if (promptTokens > 0 || responseTokens > 0) {
                totalInput += promptTokens;
                totalOutput += responseTokens;
            } else if (totalTokens > 0) {
                totalInput += Math.round(totalTokens / 2);
                totalOutput += totalTokens - Math.round(totalTokens / 2);
            }
        });

        inputTokens.push(totalInput);
        outputTokens.push(totalOutput);
    });

    tokenChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: agentTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)),
            datasets: [
                {
                    label: 'Input Tokens',
                    data: inputTokens,
                    backgroundColor: '#3b82f6',
                    stack: 'stack0'
                },
                {
                    label: 'Output Tokens',
                    data: outputTokens,
                    backgroundColor: '#8b5cf6',
                    stack: 'stack0'
                }
            ]
        },
        options: chartDefaults
    });
}

// Response time distribution chart
function createResponseTimeChart(records) {
    const ctx = document.getElementById('response-time-chart');
    if (!ctx) return;

    if (responseTimeChart) responseTimeChart.destroy();

    const buckets = [0, 0, 0, 0]; // <1s, 1-3s, 3-5s, >5s

    records.forEach(record => {
        const duration = record.duration || 0;
        if (duration < 1000) buckets[0]++;
        else if (duration < 3000) buckets[1]++;
        else if (duration < 5000) buckets[2]++;
        else buckets[3]++;
    });

    responseTimeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['< 1s', '1-3s', '3-5s', '> 5s'],
            datasets: [{
                data: buckets.every(b => b === 0) ? [1, 0, 0, 0] : buckets,
                backgroundColor: ['#22c55e', '#3b82f6', '#fbbf24', '#ef4444']
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: { position: 'bottom' }
            }
        }
    });
}

// --- Add this new function for agent-wise response time distribution ---
function createAgentResponseTimeChart(records) {
    const ctx = document.getElementById('agent-response-time-chart');
    if (!ctx) return;

    // Destroy previous chart if exists
    if (window.agentResponseTimeChart) window.agentResponseTimeChart.destroy();

    const agentTypes = ['locator', 'chat', 'explainer', 'optimizer', 'diff', 'perf'];
    const agentLabels = agentTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    const bucketLabels = ['< 1s', '1-3s', '3-5s', '> 5s'];
    const bucketColors = ['#22c55e', '#3b82f6', '#fbbf24', '#ef4444'];

    // For each agent, count calls in each bucket
    const agentBuckets = agentTypes.map(type => {
        const buckets = [0, 0, 0, 0];
        records.filter(r => r.type === type).forEach(record => {
            const duration = record.duration || 0;
            if (duration < 1000) buckets[0]++;
            else if (duration < 3000) buckets[1]++;
            else if (duration < 5000) buckets[2]++;
            else buckets[3]++;
        });
        return buckets;
    });

    // Prepare datasets: one for each bucket, stacking across agents
    const datasets = bucketLabels.map((bucket, i) => ({
        label: bucket,
        data: agentBuckets.map(b => b[i]),
        backgroundColor: bucketColors[i],
        stack: 'stack0'
    }));

    window.agentResponseTimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: agentLabels,
            datasets: datasets
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: { display: true, position: 'bottom' },
                tooltip: {
                    ...chartDefaults.plugins.tooltip,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                ...chartDefaults.scales,
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function generateSparklineData(records, type) {
    const typeRecords = type ? records.filter(r => r.type === type) : records;

    if (typeRecords.length === 0) {
        return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    const last10 = typeRecords.slice(-10);

    // For token sparklines, calculate total tokens properly with multiple field checks
    const data = last10.map(r => {
        const promptTokens = r.promptTokens || r.prompt_tokens || r.usage?.prompt_tokens || 0;
        const responseTokens = r.responseTokens || r.completion_tokens || r.response_tokens || r.usage?.completion_tokens || 0;
        const totalTokens = r.totalTokens || r.total_tokens || r.usage?.total_tokens || (promptTokens + responseTokens);

        // Return tokens if available, otherwise duration
        return totalTokens > 0 ? totalTokens : (r.duration || 1);
    });

    while (data.length < 10) {
        data.unshift(0);
    }

    return data;
}

function renderDashboard(records = []) {
    // --- 1. Calculate Statistics ---
    const totalCalls = records.length;

    // Enhanced debugging - check each record
    // console.log('🔍 Token Analysis:');
    // records.forEach((rec, idx) => {
    //     if (idx < 5) { // Log first 5 records in detail
    //         console.log(`Record ${idx}:`, {
    //             type: rec.type,
    //             model: rec.model,
    //             totalTokens: rec.totalTokens,
    //             promptTokens: rec.promptTokens,
    //             responseTokens: rec.responseTokens,
    //             usage: rec.usage,
    //             fullRecord: rec
    //         });
    //     }
    // });

    // Fix token calculation - check multiple possible field names
    const totalTokens = records.reduce((sum, rec) => {
        // Check various possible locations for token data
        const promptTokens = rec.promptTokens || rec.prompt_tokens || rec.usage?.prompt_tokens || 0;
        const responseTokens = rec.responseTokens || rec.completion_tokens || rec.response_tokens || rec.usage?.completion_tokens || 0;
        const totalFromRecord = rec.totalTokens || rec.total_tokens || rec.usage?.total_tokens || (promptTokens + responseTokens);

        if (totalFromRecord > 0) {
            // console.log(`✅ Found tokens in record:`, { promptTokens, responseTokens, totalFromRecord });
        }

        return sum + totalFromRecord;
    }, 0);

    const locatorCalls = records.filter(r => r.type === 'locator').length;
    const chatCalls = records.filter(r => r.type === 'chat').length;
    const explainerCalls = records.filter(r => r.type === 'explainer').length;
    const optimizerCalls = records.filter(r => r.type === 'optimizer').length;
    const diffCalls = records.filter(r => r.type === 'diff').length;
    const perfCalls = records.filter(r => r.type === 'perf').length;
    const avgTokens = totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0;
    const estimatedCost = (totalTokens / 1_000_000) * 1.00;

    // Debug: Log token data to console
    // console.log('📈 Dashboard Summary:', {
    //     totalCalls,
    //     totalTokens,
    //     avgTokens,
    //     estimatedCost,
    //     recordsWithTokens: records.filter(r => {
    //         const hasTokens = r.totalTokens || r.total_tokens || r.promptTokens || r.prompt_tokens ||
    //             r.responseTokens || r.completion_tokens || r.usage?.total_tokens;
    //         return hasTokens > 0;
    //     }).length
    // });

    // --- 2. Update Stat Cards ---
    const setStatCard = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toLocaleString();
    };
    setStatCard('total-calls', totalCalls);
    setStatCard('total-tokens', totalTokens);
    setStatCard('locator-calls', locatorCalls);
    setStatCard('chat-calls', chatCalls);
    setStatCard('explainer-calls', explainerCalls);
    setStatCard('optimizer-calls', optimizerCalls);
    setStatCard('diff-checker-calls', diffCalls);
    setStatCard('perf-calls', perfCalls); // <-- fix: use correct perf stat card
    setStatCard('avg-tokens', avgTokens);
    const costEl = document.getElementById('estimated-cost');
    if (costEl) costEl.textContent = `$${estimatedCost.toFixed(4)}`;

    // --- 3. Create sparklines for each metric ---
    // Use call count for total calls sparkline
    const callCountSparkData = records.slice(-10).map((_, i) => i + 1);
    while (callCountSparkData.length < 10) callCountSparkData.unshift(0);
    createSparkline('spark-total-calls', callCountSparkData, '#3b82f6');

    // Fix token sparkline to use actual token data with multiple field checks
    const tokenSparkData = records.slice(-10).map(r => {
        const promptTokens = r.promptTokens || r.prompt_tokens || r.usage?.prompt_tokens || 0;
        const responseTokens = r.responseTokens || r.completion_tokens || r.response_tokens || r.usage?.completion_tokens || 0;
        return r.totalTokens || r.total_tokens || r.usage?.total_tokens || (promptTokens + responseTokens);
    });
    while (tokenSparkData.length < 10) tokenSparkData.unshift(0);
    createSparkline('spark-total-tokens', tokenSparkData, '#8b5cf6');

    // Average tokens per call sparkline
    const avgTokenSparkData = records.slice(-10).map(r => {
        const promptTokens = r.promptTokens || r.prompt_tokens || r.usage?.prompt_tokens || 0;
        const responseTokens = r.responseTokens || r.completion_tokens || r.response_tokens || r.usage?.completion_tokens || 0;
        return r.totalTokens || r.total_tokens || r.usage?.total_tokens || (promptTokens + responseTokens);
    });
    while (avgTokenSparkData.length < 10) avgTokenSparkData.unshift(0);
    createSparkline('spark-avg-tokens', avgTokenSparkData, '#06b6d4');

    // Cost sparkline based on tokens
    const costSparkData = tokenSparkData.map(v => v / 1000000);
    createSparkline('spark-cost', costSparkData, '#f59e0b');

    createSparkline('spark-locator', generateSparklineData(records, 'locator'), '#22c55e');
    createSparkline('spark-chat', generateSparklineData(records, 'chat'), '#ec4899');
    createSparkline('spark-explainer', generateSparklineData(records, 'explainer'), '#6366f1');
    createSparkline('spark-optimizer', generateSparklineData(records, 'optimizer'), '#84cc16');
    createSparkline('spark-diff', generateSparklineData(records, 'diff'), '#14b8a6');
    createSparkline('spark-perf', generateSparklineData(records, 'perf'), '#f59e0b'); // <-- fix: use correct perf sparkline

    // --- 4. Create advanced charts ---
    createPerformanceSpikeChart(records);
    createCallsTimelineChart(records);
    createTokenAnalysisChart(records);
    createResponseTimeChart(records);
    createAgentResponseTimeChart(records); // <-- Add this line

    // --- 5. Process Data for Model Stats Table and Chart ---
    const modelStats = records.reduce((acc, rec) => {
        const model = rec.model || 'unknown';
        if (!acc[model]) {
            acc[model] = { calls: 0, tokens: 0 };
        }
        acc[model].calls++;

        // Fix token counting for model stats with multiple field checks
        const promptTokens = rec.promptTokens || rec.prompt_tokens || rec.usage?.prompt_tokens || 0;
        const responseTokens = rec.responseTokens || rec.completion_tokens || rec.response_tokens || rec.usage?.completion_tokens || 0;
        const totalFromRecord = rec.totalTokens || rec.total_tokens || rec.usage?.total_tokens || (promptTokens + responseTokens);
        acc[model].tokens += totalFromRecord;

        return acc;
    }, {});

    // --- 6. Populate the Model Stats Data Table ---
    const modelTableBody = document.getElementById('model-stats-body');
    if (Object.keys(modelStats).length === 0) {
        modelTableBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-500">No usage data recorded yet.</td></tr>`;
    } else {
        modelTableBody.innerHTML = Object.entries(modelStats).map(([modelName, stats]) => `
            <tr class="border-b border-slate-200/50 last:border-b-0">
                <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${modelName}</td>
                <td class="p-3 text-slate-700 dark:text-slate-300">${stats.calls.toLocaleString()}</td>
                <td class="p-3 text-slate-700 dark:text-slate-300">${stats.tokens.toLocaleString()}</td>
            </tr>`
        ).join('');
    }

    // --- 7. Render the Model Usage Chart ---
    const ctx = document.getElementById('model-usage-chart').getContext('2d');
    if (usageChart) {
        usageChart.destroy();
    }
    usageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(modelStats).length > 0 ? Object.keys(modelStats) : ['No Data'],
            datasets: [{
                label: 'Total Tokens Used',
                data: Object.keys(modelStats).length > 0 ? Object.values(modelStats).map(s => s.tokens) : [0],
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

    // --- 8. Populate the Agent Performance Table ---
    const agentTypes = ['locator', 'chat', 'explainer', 'optimizer', 'diff', 'perf']; // <-- add 'perf'
    const perfTableBody = document.getElementById('agent-performance-body');

    if (records.length === 0) {
        perfTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">No performance data yet.</td></tr>`;
    } else {
        const perfHtml = agentTypes.map(type => {
            const agentRecords = records.filter(r => r.type === type);
            const callCount = agentRecords.length;
            const durations = agentRecords.map(r => r.duration);
            const p90 = calculateP90(durations);
            // Fix agent name for perf
            const agentName = type === 'perf' ? 'Performance Checker' : type.charAt(0).toUpperCase() + type.slice(1);

            // Calculate trend based on recent performance
            let trend = 'stable';
            if (agentRecords.length > 1) {
                const recentAvg = agentRecords.slice(-5).reduce((sum, r) => sum + (r.duration || 0), 0) / Math.min(5, agentRecords.length);
                const olderAvg = agentRecords.slice(0, -5).reduce((sum, r) => sum + (r.duration || 0), 0) / Math.max(1, agentRecords.length - 5);
                if (recentAvg < olderAvg * 0.9) trend = 'up'; // Faster = better = up
                else if (recentAvg > olderAvg * 1.1) trend = 'down'; // Slower = worse = down
            }

            return `
                <tr class="border-b border-slate-200/80 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${agentName}</td>
                    <td class="p-3 text-slate-700 dark:text-slate-300">${callCount.toLocaleString()}</td>
                    <td class="p-3 text-slate-700 dark:text-slate-300">${p90 > 0 ? p90.toLocaleString() : 'N/A'}</td>
                    <td class="p-3">
                        <span class="trend-${trend}">
                            ${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
        perfTableBody.innerHTML = perfHtml;
    }
}

function generateResponseTimeData(stats) {
    return [45, 30, 15, 10];
}

function updateAgentPerformanceTable(stats) {
    const tbody = document.getElementById('agent-performance-body');
    if (!tbody) return;

    // Sample data - replace with actual stats
    const agents = [
        { name: 'Locator', calls: 45, p90: 1250, trend: 'up' },
        { name: 'Chat', calls: 38, p90: 2100, trend: 'down' },
        { name: 'Explainer', calls: 29, p90: 1800, trend: 'stable' },
        { name: 'Optimizer', calls: 22, p90: 1450, trend: 'up' },
        { name: 'Diff Checker', calls: 15, p90: 980, trend: 'down' },
        { name: 'Performance', calls: 10, p90: 3000, trend: 'stable' }
    ];

    tbody.innerHTML = agents.map(agent => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <td class="p-3 font-medium">${agent.name}</td>
            <td class="p-3">${agent.calls}</td>
            <td class="p-3">${agent.p90}</td>
            <td class="p-3">
                <span class="trend-${agent.trend}">
                    ${agent.trend === 'up' ? '↑' : agent.trend === 'down' ? '↓' : '→'}
                </span>
            </td>
        </tr>
    `).join('');
}
