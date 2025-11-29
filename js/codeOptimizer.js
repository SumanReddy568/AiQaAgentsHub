import { optimizeCodeWithSnippet } from './agents/codeOptimiserAgent.js';
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

function renderOptimizedResult(markdown) {
    outputDiv.innerHTML = '';
    if (!markdown) {
        outputDiv.innerHTML = '<div class="text-slate-400 text-center py-8">Paste your code and click "Optimize Code" to generate optimized code</div>';
        copyBtn.classList.add('hidden');
        lastOptimizedCode = '';
        return;
    }

    // Extract code block
    const codeMatch = markdown.match(/```(\w+)?\s*([\s\S]*?)```/);
    let codeHtml = '';
    if (codeMatch) {
        codeHtml = `<pre class="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm mb-4"><code>${codeMatch[2].replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        lastOptimizedCode = codeMatch[2].trim();
        copyBtn.classList.remove('hidden');
    } else {
        lastOptimizedCode = '';
        copyBtn.classList.add('hidden');
    }

    // Extract explanation: everything after the first code block and first heading (## or ###)
    let explanationHtml = '';
    let explanation = '';
    if (codeMatch) {
        // Remove code block from markdown
        const afterCode = markdown.slice(codeMatch.index + codeMatch[0].length);
        // Find first heading (## or ###)
        const headingMatch = afterCode.match(/(##+ .+|### .+)/);
        if (headingMatch) {
            explanation = afterCode.slice(headingMatch.index);
        } else {
            explanation = afterCode.trim();
        }
    }
    if (explanation) {
        explanationHtml = `<div class="prose prose-sm max-w-none mt-2 scrollable">${marked.parse(explanation)}</div>`;
    }

    outputDiv.innerHTML = codeHtml + explanationHtml;
}

renderOptimizedResult('');

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
        const result = await optimizeCodeWithSnippet(code, language);
        renderOptimizedResult(result);
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