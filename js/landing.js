// js/landing.js

import { initDB, getAllApiCalls } from './db.js';
import { loadSettingsFromStorage, populateSettingsForm, initSettings } from './settings.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();

        // Load settings from localStorage into the state
        loadSettingsFromStorage();

        // Initialize the settings modal button and its functionality
        initSettings();

        // Populate the settings form with loaded data (important for when the modal is opened)
        populateSettingsForm();

        // Render the stats on the page
        const records = await getAllApiCalls();
        renderStatHighlights(records);

    } catch (error) {
        console.error("Failed to load dashboard highlights:", error);
    }
});

function renderStatHighlights(records = []) {
    const totalCalls = records.length;
    const totalTokens = records.reduce((sum, rec) => sum + (rec.totalTokens || 0), 0);
    const locatorTasks = records.filter(r => r.type === 'locator').length;
    const explainerTasks = records.filter(r => r.type === 'explainer').length;
    const tasksCompleted = locatorTasks + explainerTasks;
    const estimatedCost = (totalTokens / 1_000_000) * 1.00; // Assuming $1/1M tokens

    document.getElementById('total-calls').textContent = totalCalls.toLocaleString();
    document.getElementById('total-tokens').textContent = totalTokens.toLocaleString();
    document.getElementById('tasks-completed').textContent = tasksCompleted.toLocaleString();
    document.getElementById('estimated-cost').textContent = `$${estimatedCost.toFixed(4)}`;
}