// js/explainer.js

import { initDB } from './db.js';
import { loadSettingsFromStorage } from './settings.js';
import { getCodeExplanation } from './agents/codeExplainerAgent.js';
// DOM Elements
const languageSelect = document.getElementById('language-select');
const frameworkSelect = document.getElementById('framework-select');
const codeInput = document.getElementById('code-input');
const explainBtn = document.getElementById('explain-btn');
const outputContent = document.getElementById('output-content');
const loader = document.getElementById('optimizer-loader');
const emptyState = document.getElementById('explainer-empty-state');

const showdownConverter = new showdown.Converter({
    ghCompatibleHeaderId: true,
    simpleLineBreaks: true,
    tables: true,
    strikethrough: true
});

async function handleExplainClick() {
    const code = codeInput.value.trim();
    if (!code) {
        alert("Please paste some code to explain.");
        return;
    }

    const options = {
        code,
        language: languageSelect.value,
        framework: frameworkSelect.value
    };

    if (loader) loader.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    outputContent.innerHTML = '';
    explainBtn.disabled = true;
    explainBtn.textContent = 'Analyzing...';

    try {
        const explanation = await getCodeExplanation(options);
        outputContent.innerHTML = showdownConverter.makeHtml(explanation);
        outputContent.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

    } catch (error) {
        console.error("Explanation failed:", error);
        outputContent.innerHTML = `<p class="text-red-500">Sorry, an error occurred: ${error.message}</p>`;
    } finally {
        if (loader) loader.classList.add('hidden');
        explainBtn.disabled = false;
        explainBtn.textContent = 'Explain Code';
    }
}


async function init() {
    loadSettingsFromStorage();
    await initDB();
    explainBtn.addEventListener('click', handleExplainClick);
}

document.addEventListener('DOMContentLoaded', init);
