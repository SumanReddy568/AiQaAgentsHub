import { getWcagExplanation } from "./agents/wcagAgent.js";
import { addApiCall, initDB } from './db.js';
import { loadSettingsFromStorage } from './settings.js';

const wcagRuleInput = document.getElementById('wcagRuleInput');
const explainBtn = document.getElementById('explainBtn');
const output = document.getElementById('output');
const explanation = document.getElementById('explanation');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');

function checkApiKey() {
    const provider = window.AI_PROVIDER || localStorage.getItem('ai-provider') || 'gemini';
    const apiKey = localStorage.getItem(`${provider}-api-key`);
    return apiKey ? true : false;
}

explainBtn.addEventListener('click', async () => {
    if (!checkApiKey()) {
        alert('API key not configured. Please go to settings and configure your API key.');
        window.location.href = 'index.html#settings';
        return;
    }

    const ruleName = wcagRuleInput.value.trim();
    
    if (!ruleName) {
        alert('Please enter a WCAG rule name');
        return;
    }
    
    explainBtn.disabled = true;
    explainBtn.textContent = 'Analyzing...';
    if (loading) loading.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    output.classList.add('hidden');
    explanation.innerHTML = '';
    
    try {
        const result = await getWcagExplanation(ruleName);
        explanation.innerHTML = marked.parse(result.explanation);
        
        // Add spacing classes to improve readability
        explanation.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            heading.classList.add('mt-6', 'mb-3', 'font-bold');
        });
        explanation.querySelectorAll('p').forEach(p => {
            p.classList.add('mb-4', 'leading-relaxed');
        });
        explanation.querySelectorAll('code').forEach(code => {
            code.classList.add('bg-slate-100', 'px-2', 'py-1', 'rounded', 'text-sm', 'font-mono');
        });
        explanation.querySelectorAll('pre').forEach(pre => {
            pre.classList.add('bg-slate-900', 'text-slate-100', 'p-4', 'rounded-lg', 'overflow-x-auto', 'my-4');
        });
        explanation.querySelectorAll('ul, ol').forEach(list => {
            list.classList.add('ml-6', 'my-4', 'space-y-2');
        });
        
        output.classList.remove('hidden');
    } catch (error) {
        explanation.innerHTML = `<div class="p-4 bg-red-50 border-l-4 border-red-500 rounded"><p class="text-red-600 font-semibold">Error</p><p class="text-red-600 text-sm mt-1">${error.message}</p></div>`;
        output.classList.remove('hidden');
    } finally {
        if (loading) loading.classList.add('hidden');
        explainBtn.disabled = false;
        explainBtn.textContent = 'Explain';
    }
});

wcagRuleInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') explainBtn.click();
});

async function init() {
    loadSettingsFromStorage();
    await initDB();
}

document.addEventListener('DOMContentLoaded', init);
