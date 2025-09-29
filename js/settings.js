// js/settings.js

import { state, updateState } from './state.js';
import * as DOM from './dom.js';

/**
 * Loads settings from localStorage into the shared state object.
 */
export function loadSettingsFromStorage() {
    const savedKey = localStorage.getItem('gemini-api-key');
    const savedModel = localStorage.getItem('selected-model');

    const updates = {};
    if (savedKey) updates.apiKey = savedKey;
    if (savedModel) updates.selectedModel = savedModel;

    updateState(updates);
}

/**
 * Updates the settings form UI based on the current state. Must be called on a page that has the settings modal.
 */
export function populateSettingsForm() {
    if (DOM.apiKeyInput) DOM.apiKeyInput.value = state.apiKey;
    if (DOM.modelSelect) DOM.modelSelect.value = state.selectedModel;
    if (DOM.apiStatus) DOM.apiStatus.classList.toggle('hidden', !state.apiKey);
}

/**
 * Handles the logic for saving settings from the modal.
 */
function handleSettingsSave() {
    const key = DOM.apiKeyInput.value.trim();
    if (key) {
        updateState({ apiKey: key, selectedModel: DOM.modelSelect.value });
        localStorage.setItem('gemini-api-key', state.apiKey);
        localStorage.setItem('selected-model', state.selectedModel);

        if (DOM.apiStatus) DOM.apiStatus.classList.remove('hidden');
        alert('Settings saved successfully!');
        closeModal();
    } else {
        alert('Please enter a valid API key.');
    }
}

function openModal() {
    if (DOM.settingsModal) DOM.settingsModal.classList.remove('invisible', 'opacity-0');
}

function closeModal() {
    if (DOM.settingsModal) DOM.settingsModal.classList.add('invisible', 'opacity-0');
}

/**
 * Initializes all event listeners for the settings modal. Must be called on a page that has the modal.
 */
export function initSettings() {
    if (DOM.settingsBtn) {
        DOM.settingsBtn.addEventListener('click', openModal);
        DOM.closeModalBtn.addEventListener('click', closeModal);
        DOM.cancelSettingsBtn.addEventListener('click', closeModal);
        DOM.saveSettingsBtn.addEventListener('click', handleSettingsSave);
    }
}