// js/state.js

export let state = {
    apiKey: '',
    selectedModel: 'gemini-1.5-flash-latest',
    generatedLocators: [],
    isChatting: false,
};

export function updateState(newState) {
    state = { ...state, ...newState };
}