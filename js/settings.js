// js/settings.js

import { state, updateState } from './state.js';
import * as DOM from './dom.js';

/**
 * Loads settings from localStorage into the shared state object.
 */
export function loadSettingsFromStorage() {
    const savedProvider = localStorage.getItem('ai-provider') || 'gemini';
    const savedGeminiKey = localStorage.getItem('gemini-api-key');
    const savedDeepseekKey = localStorage.getItem('deepseek-api-key');
    const savedModel = localStorage.getItem('selected-model');

    const updates = {};
    if (savedProvider) updates.provider = savedProvider;
    if (savedGeminiKey) updates.geminiApiKey = savedGeminiKey;
    if (savedDeepseekKey) updates.deepseekApiKey = savedDeepseekKey;
    // Keep apiKey as the active provider key for quick access
    updates.apiKey = savedProvider === 'deepseek' ? (savedDeepseekKey || '') : (savedGeminiKey || '');
    if (savedModel) updates.selectedModel = savedModel;

    updateState(updates);
}

/**
 * Updates the settings form UI based on the current state. Must be called on a page that has the settings modal.
 */
export function populateSettingsForm() {
    if (DOM.providerSelect) DOM.providerSelect.value = state.provider || 'gemini';
    if (DOM.apiKeyInput) DOM.apiKeyInput.value = state.geminiApiKey || '';
    if (DOM.deepseekApiKeyInput) DOM.deepseekApiKeyInput.value = state.deepseekApiKey || '';
    if (DOM.modelSelect) DOM.modelSelect.value = state.selectedModel;
    if (DOM.apiStatus) DOM.apiStatus.classList.toggle('hidden', !state.apiKey);
}

/**
 * Handles the logic for saving settings from the modal.
 */
function handleSettingsSave() {
    const provider = (DOM.providerSelect?.value || 'gemini').trim();
    const geminiKey = (DOM.apiKeyInput?.value || '').trim();
    const deepseekKey = (DOM.deepseekApiKeyInput?.value || '').trim();
    const selectedModel = (DOM.modelSelect?.value || 'gemini-2.5-flash').trim();

    // Validate based on selected provider
    if (provider === 'gemini' && !geminiKey) {
        alert('Please enter a valid Gemini API key.');
        return;
    }
    if (provider === 'deepseek' && !deepseekKey) {
        alert('Please enter a valid DeepSeek API key.');
        return;
    }

    const activeKey = provider === 'deepseek' ? deepseekKey : geminiKey;

    updateState({
        provider,
        geminiApiKey: geminiKey,
        deepseekApiKey: deepseekKey,
        apiKey: activeKey,
        selectedModel
    });

    localStorage.setItem('ai-provider', provider);
    localStorage.setItem('gemini-api-key', geminiKey);
    localStorage.setItem('deepseek-api-key', deepseekKey);
    localStorage.setItem('selected-model', selectedModel);

    if (DOM.apiStatus) DOM.apiStatus.classList.remove('hidden');
    alert('Settings saved successfully!');
    closeModal();
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