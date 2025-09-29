// js/settings.js

import { state, updateState } from './state.js';

/**
 * Loads the API key and selected model from localStorage into the shared state.
 */
export function loadSettingsFromStorage() {
    const savedKey = localStorage.getItem('gemini-api-key');
    const savedModel = localStorage.getItem('selected-model');

    const updates = {};
    if (savedKey) {
        updates.apiKey = savedKey;
    }
    if (savedModel) {
        updates.selectedModel = savedModel;
    }

    updateState(updates);
}