// js/explainer.js

import { initDB } from './db.js';
import * as AI from './aiService.js';
import { loadSettingsFromStorage } from './settings.js';

// DOM Elements
const languageSelect = document.getElementById('language-select');
const frameworkSelect = document.getElementById('framework-select');
const codeInput = document.getElementById('code-input');
const explainBtn = document.getElementById('explain-btn');
const outputContent = document.getElementById('output-content');
const loader = document.getElementById('explainer-loader');
const emptyState = document.getElementById('explainer-empty-state');

// CORRECTED: Configure Showdown for better formatting (like GitHub)
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

    loader.classList.remove('hidden');
    emptyState.classList.add('hidden');
    outputContent.innerHTML = '';
    explainBtn.disabled = true;
    explainBtn.textContent = 'Analyzing...';

    try {
        const explanation = await AI.getCodeExplanation(options);
        outputContent.innerHTML = showdownConverter.makeHtml(explanation);

        // CORRECTED: Find all new code blocks and apply syntax highlighting
        outputContent.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

    } catch (error) {
        console.error("Explanation failed:", error);
        outputContent.innerHTML = `<p class="text-red-500">Sorry, an error occurred: ${error.message}</p>`;
    } finally {
        loader.classList.add('hidden');
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
