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
    const savedOpenrouterKey = localStorage.getItem('openrouter-api-key');
    const savedModel = localStorage.getItem('selected-model');

    const updates = {};
    if (savedProvider) updates.provider = savedProvider;
    if (savedGeminiKey) updates.geminiApiKey = savedGeminiKey;
    if (savedDeepseekKey) updates.deepseekApiKey = savedDeepseekKey;
    if (savedOpenrouterKey) updates.openrouterApiKey = savedOpenrouterKey;
    // Keep apiKey as the active provider key for quick access
    if (savedProvider === 'deepseek') {
        updates.apiKey = savedDeepseekKey || '';
    } else if (savedProvider === 'openrouter') {
        updates.apiKey = savedOpenrouterKey || '';
    } else {
        updates.apiKey = savedGeminiKey || '';
    }
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
    if (DOM.openrouterApiKeyInput) DOM.openrouterApiKeyInput.value = state.openrouterApiKey || '';

    // Correctly set model field values based on provider
    if (DOM.providerSelect && DOM.modelSelect && DOM.customModelInput) {
        if (DOM.providerSelect.value === 'gemini') {
            DOM.modelSelect.value = state.selectedModel || 'gemini-2.5-flash';
            DOM.customModelInput.value = '';
        } else {
            DOM.modelSelect.value = 'gemini-2.5-flash'; // Reset to default for non-gemini
            DOM.customModelInput.value = state.selectedModel || '';
        }
    }

    if (DOM.apiStatus) DOM.apiStatus.classList.toggle('hidden', !state.apiKey);

    // Sync theme preference
    const savedTheme = localStorage.getItem('theme-preference') || 'light';
    const themeRadios = document.querySelectorAll('input[name="theme-preference"]');
    themeRadios.forEach(radio => {
        radio.checked = radio.value === savedTheme;
    });

    // Ensure correct fields are visible after refresh
    updateApiKeyFieldVisibility();
    updateModelFieldVisibility();
}

/**
 * Handles the logic for saving settings from the modal.
 */
function handleSettingsSave() {
    const provider = (DOM.providerSelect?.value || 'gemini').trim();
    const geminiKey = (DOM.apiKeyInput?.value || '').trim();
    const deepseekKey = (DOM.deepseekApiKeyInput?.value || '').trim();
    const openrouterKey = (DOM.openrouterApiKeyInput?.value || '').trim();
    
    // Get model based on provider
    let selectedModel;
    if (provider === 'gemini') {
        selectedModel = (DOM.modelSelect?.value || 'gemini-2.5-flash').trim();
    } else {
        selectedModel = (DOM.customModelInput?.value || '').trim();
    }

    // Validate based on selected provider
    if (provider === 'gemini' && !geminiKey) {
        alert('Please enter a valid Gemini API key.');
        return;
    }
    if (provider === 'deepseek' && !deepseekKey) {
        alert('Please enter a valid DeepSeek API key.');
        return;
    }
    if (provider === 'openrouter' && !openrouterKey) {
        alert('Please enter a valid OpenRouter API key.');
        return;
    }
    
    // Validate model
    if (!selectedModel) {
        alert('Please enter a model name.');
        return;
    }

    const activeKey = provider === 'deepseek' ? deepseekKey : (provider === 'openrouter' ? openrouterKey : geminiKey);

    updateState({
        provider,
        geminiApiKey: geminiKey,
        deepseekApiKey: deepseekKey,
        openrouterApiKey: openrouterKey,
        apiKey: activeKey,
        selectedModel // <-- This will now persist the correct model for all providers
    });

    localStorage.setItem('ai-provider', provider);
    localStorage.setItem('gemini-api-key', geminiKey);
    localStorage.setItem('deepseek-api-key', deepseekKey);
    localStorage.setItem('openrouter-api-key', openrouterKey);
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
 * Toggles visibility of API key sections based on selected provider.
 */
function updateApiKeyFieldVisibility() {
    const provider = DOM.providerSelect?.value || 'gemini';
    const geminiSection = document.getElementById('gemini-key-section');
    const deepseekSection = document.getElementById('deepseek-key-section');
    const openrouterSection = document.getElementById('openrouter-key-section');

    // Hide all sections
    if (geminiSection) geminiSection.classList.add('hidden');
    if (deepseekSection) deepseekSection.classList.add('hidden');
    if (openrouterSection) openrouterSection.classList.add('hidden');

    // Show only the selected provider's section
    if (provider === 'gemini' && geminiSection) {
        geminiSection.classList.remove('hidden');
    } else if (provider === 'deepseek' && deepseekSection) {
        deepseekSection.classList.remove('hidden');
    } else if (provider === 'openrouter' && openrouterSection) {
        openrouterSection.classList.remove('hidden');
    }
}

/**
 * Toggles visibility of model selection based on provider.
 */
function updateModelFieldVisibility() {
    const provider = DOM.providerSelect?.value || 'gemini';
    const geminiModelSection = document.getElementById('gemini-model-section');
    const customModelSection = document.getElementById('custom-model-section');

    if (provider === 'gemini') {
        if (geminiModelSection) geminiModelSection.classList.remove('hidden');
        if (customModelSection) customModelSection.classList.add('hidden');
    } else {
        if (geminiModelSection) geminiModelSection.classList.add('hidden');
        if (customModelSection) customModelSection.classList.remove('hidden');
        // Clear custom model input placeholder by resetting it
        if (DOM.customModelInput) DOM.customModelInput.placeholder = 'e.g., openai/gpt-4o, deepseek-chat';
    }
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
    
    // Add provider change listener
    if (DOM.providerSelect) {
        DOM.providerSelect.addEventListener('change', () => {
            updateApiKeyFieldVisibility();
            updateModelFieldVisibility();
        });
    }
    
    // Add theme preference change listener
    const themeRadios = document.querySelectorAll('input[name="theme-preference"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            localStorage.setItem('theme-preference', e.target.value);
        });
    });
    
    // Initialize visibility on first load
    updateApiKeyFieldVisibility();
    updateModelFieldVisibility();
}