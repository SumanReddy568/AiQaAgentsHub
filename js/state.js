// js/state.js

export let state = {
    provider: 'gemini',
    apiKey: '', // Active key for current provider (for quick access)
    geminiApiKey: '',
    deepseekApiKey: '',
    selectedModel: 'gemini-2.5-flash',
    generatedLocators: [],
    isChatting: false,
};

export function updateState(newState) {
    state = { ...state, ...newState };
}