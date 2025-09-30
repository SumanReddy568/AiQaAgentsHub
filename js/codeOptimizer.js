import { optimizeCodeWithDiff } from './aiService.js';
import { loadSettingsFromStorage } from './settings.js';
import { initDB } from './db.js';

const codeInput = document.getElementById('code-input');
const languageSelect = document.getElementById('language-select');
const optimizeBtn = document.getElementById('optimize-btn');
const outputDiv = document.getElementById('optimizer-output');
const loader = document.getElementById('optimizer-loader');
const toastContainer = document.getElementById('toast-container');
const copyBtn = document.getElementById('copy-optimized-btn');

function showLoader(show) {
    loader.classList.toggle('hidden', !show);
}

function showToast(msg, type = 'info', timeout = 3000) {
    if (!toastContainer) return;
    const div = document.createElement('div');
    div.className = `toast ${type} glass-effect px-4 py-2 rounded-xl shadow text-sm font-semibold`;
    div.textContent = msg;
    toastContainer.appendChild(div);
    setTimeout(() => div.remove(), timeout);
}

let lastOptimizedCode = ''; // Store the latest optimized code for copying

function extractOptimizedCodeFromDiff(diffMarkdown) {
    // Extract the optimized code from the diff (lines not starting with '-' and not diff headers)
    const match = diffMarkdown.match(/```diff\s*([\s\S]*?)```/);
    const diffText = match ? match[1].trim() : diffMarkdown.trim();
    return diffText
        .split('\n')
        .filter(line =>
            !line.startsWith('-') &&
            !line.startsWith('@@') &&
            !line.startsWith('+++') &&
            !line.startsWith('---')
        )
        .map(line => line.startsWith('+') ? line.slice(1) : line)
        .join('\n')
        .trim();
}

function renderDiff(diffMarkdown) {
    outputDiv.innerHTML = '';
    if (!diffMarkdown) {
        outputDiv.innerHTML = '<div class="text-slate-400 text-center py-8">Paste your code and click "Optimize Code" to generate optimized code</div>';
        copyBtn.classList.add('hidden');
        lastOptimizedCode = '';
        return;
    }
    const match = diffMarkdown.match(/```diff\s*([\s\S]*?)```/);
    const diffText = match ? match[1].trim() : diffMarkdown.trim();

    const html = diffText.split('\n').map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            return `<span style="background:#052e16;color:#22c55e;display:block;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
            return `<span style="background:#58151c;color:#ef4444;display:block;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        }
        if (line.startsWith('@@')) {
            return `<span style="background:#1e293b;color:#fbbf24;display:block;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        }
        return `<span style="display:block;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
    }).join('');

    const pre = document.createElement('pre');
    pre.className = 'bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm';
    pre.innerHTML = `<code>${html}</code>`;
    outputDiv.appendChild(pre);

    // Extract and store the optimized code for copying
    lastOptimizedCode = extractOptimizedCodeFromDiff(diffMarkdown);
    copyBtn.classList.toggle('hidden', !lastOptimizedCode);
}

renderDiff('');

async function handleOptimize() {
    const code = codeInput.value.trim();
    const language = languageSelect.value;
    if (!code) {
        showToast('Please paste your code snippet first.', 'warning');
        return;
    }
    showLoader(true);
    outputDiv.innerHTML = '';
    try {
        const diff = await optimizeCodeWithDiff(code, language);
        renderDiff(diff);
    } catch (err) {
        showToast(err.message || 'Optimization failed.', 'error', 5000);
    } finally {
        showLoader(false);
    }
}

async function init() {
    loadSettingsFromStorage();
    await initDB();
    optimizeBtn.addEventListener('click', handleOptimize);
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (!lastOptimizedCode) return;
            try {
                await navigator.clipboard.writeText(lastOptimizedCode);
                showToast('Optimized code copied!', 'success');
            } catch {
                showToast('Failed to copy code.', 'error');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', init);