import { getDiffAnalysis } from './aiService.js';
import { state } from './state.js';
import { initDB } from './db.js';
import { loadSettingsFromStorage } from './settings.js';

/**
 * Object to hold references to key DOM elements.
 * @type {Object.<string, HTMLElement>}
 */
const ui = {
    leftInput: document.getElementById('left-input'),
    rightInput: document.getElementById('right-input'),
    diffType: document.getElementById('diff-type'),
    diffBtn: document.getElementById('diff-btn'),
    loader: document.getElementById('diff-loader'),
    output: document.getElementById('diff-output'),
    diffBlock: document.getElementById('diff-block'),
    diffSummary: document.getElementById('diff-summary'),
    diffButtonText: document.getElementById('diff-btn-text'),
};

/**
 * Sets the UI to a loading state while the AI is analyzing.
 * @param {boolean} isLoading - Whether to show or hide the loading state.
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        ui.loader.classList.remove('hidden');
        ui.output.classList.add('hidden');
        ui.diffBtn.disabled = true;
        ui.diffButtonText.textContent = 'Analyzing...';
    } else {
        ui.loader.classList.add('hidden');
        ui.diffBtn.disabled = false;
        ui.diffButtonText.textContent = 'Analyze Diff';
    }
}

/**
 * Displays the analysis result in the UI.
 * @param {object} result - The result from the AI analysis.
 * @param {string} result.diff - The generated diff text.
 * @param {string} result.summary - The AI-generated summary.
 */
function showResult({ diff, summary }) {
    // Update diff section with red/green highlights
    if (diff && diff.trim()) {
        const diffLines = diff.split('\n').map(line => {
            if (line.startsWith('+')) {
                return `<div class="diff-line added">${line}</div>`;
            } else if (line.startsWith('-')) {
                return `<div class="diff-line removed">${line}</div>`;
            } else {
                return `<div class="diff-line">${line}</div>`;
            }
        });
        ui.diffBlock.innerHTML = diffLines.join('');
    } else {
        ui.diffBlock.textContent = "No differences found between the two inputs.";
    }

    // Update summary section
    if (summary && summary.trim()) {
        // Use marked.js to parse Markdown if available
        if (typeof marked !== 'undefined' && marked.parse) {
            ui.diffSummary.innerHTML = marked.parse(summary);
        } else {
            // Fallback to plain text in a paragraph
            const p = document.createElement('p');
            p.textContent = summary;
            ui.diffSummary.innerHTML = '';
            ui.diffSummary.appendChild(p);
        }
    } else {
        ui.diffSummary.innerHTML = '<em>No summary was provided.</em>';
    }

    // Ensure the output section is visible
    ui.output.classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden'); // Hide "No results yet" message
}

/**
 * Displays an error message in the UI.
 * @param {Error} error - The error object to display.
 */
function showError(error) {
    const errorMessage = error.message || 'An unknown error occurred.';
    console.error('=== DIFF ANALYSIS FAILED ===', error);
    ui.diffBlock.textContent = `Error: ${errorMessage}`;
    ui.diffSummary.innerHTML = `<p class="text-red-600 font-semibold">Could not complete analysis: ${errorMessage}</p>`;
    ui.output.classList.remove('hidden');
}

/**
 * Handles the main diff analysis logic on button click.
 */
async function handleDiffAnalysis() {
    console.log('=== DIFF BUTTON CLICKED ===');

    const left = ui.leftInput.value.trim();
    const right = ui.rightInput.value.trim();
    const type = ui.diffType.value;

    if (!left || !right) {
        alert('Please provide content for both the left and right inputs.');
        return;
    }

    if (!state.apiKey) {
        alert('API key is not configured. Please set it on the main page.');
        return;
    }

    setLoadingState(true);

    try {
        console.log('Calling getDiffAnalysis with type:', type);
        const result = await getDiffAnalysis({ left, right, type });

        if (!result || typeof result !== 'object') {
            throw new Error('Invalid or empty response from the AI service.');
        }

        // Increment and store the Diff Checker Calls count
        const stats = JSON.parse(localStorage.getItem('aiUsageStats')) || {};
        stats.diffCheckerCalls = (stats.diffCheckerCalls || 0) + 1;
        localStorage.setItem('aiUsageStats', JSON.stringify(stats));

        showResult(result);

    } catch (error) {
        showError(error);
    } finally {
        setLoadingState(false);
    }
}

/**
 * Initializes the application.
 */
async function initializeApp() {
    console.log('DOM loaded, initializing diff-checker.');

    // Verify all essential UI elements are present
    if (Object.values(ui).some(el => !el)) {
        console.error('Critical UI element missing. Aborting initialization.');
        return;
    }

    // Load settings and initialize the database
    try {
        loadSettingsFromStorage();
        if (!state.apiKey) {
            const storedKey = localStorage.getItem('apiKey');
            const storedModel = localStorage.getItem('selectedModel');
            if (storedKey) state.apiKey = storedKey;
            if (storedModel) state.selectedModel = storedModel;
        }
        await initDB();
        console.log('DB initialized successfully.');
    } catch (err) {
        console.warn('DB initialization failed:', err);
    }

    ui.diffBtn.addEventListener('click', handleDiffAnalysis);
    console.log('Diff checker initialization complete.');
}

document.addEventListener('DOMContentLoaded', initializeApp);