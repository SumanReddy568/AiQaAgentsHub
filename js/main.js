// js/main.js

import * as DOM from './dom.js';
import { state, updateState } from './state.js';
import * as UI from './ui.js';
import * as AI from './aiService.js';
import * as Rules from './ruleService.js';
import * as Utils from './utils.js';
import { initDB } from './db.js';

function handleSettingsSave() {
    const key = DOM.apiKeyInput.value.trim();
    if (key) {
        updateState({ apiKey: key, selectedModel: DOM.modelSelect.value });
        localStorage.setItem('gemini-api-key', state.apiKey);
        localStorage.setItem('selected-model', state.selectedModel);
        UI.updateApiStatus(true);
        Utils.showToast('Settings saved!', 'success');
        UI.closeModal(DOM.settingsModal);
    } else {
        Utils.showToast('Please enter a valid API key', 'error');
    }
}

async function handleGenerateClick() {
    const htmlContent = DOM.htmlInput.value.trim();
    if (!htmlContent) {
        Utils.showToast('Please enter HTML content first', 'warning');
        return;
    }

    UI.showLoader(true);
    let allLocators = [];

    try {
        // 1. Get rule-based locators (they are already in the correct format)
        const ruleLocators = Rules.generateRuleBasedLocators(htmlContent);
        allLocators.push(...ruleLocators);

        // 2. Get AI locators and transform them into the standard format
        if (DOM.includeAiCheckbox.checked) {
            const aiResults = await AI.generateAiLocators(htmlContent);

            // This new block standardizes the AI data
            aiResults.forEach(rec => {
                if (rec.cssSelector) {
                    allLocators.push({
                        locator: rec.cssSelector,
                        type: 'CSS',
                        explanation: rec.explanation,
                        priority: rec.priority.toLowerCase(),
                        isAI: true
                    });
                }
                if (rec.xpath) {
                    allLocators.push({
                        locator: rec.xpath,
                        type: 'XPath',
                        explanation: rec.explanation,
                        priority: rec.priority.toLowerCase(),
                        isAI: true
                    });
                }
            });
        }

        updateState({ generatedLocators: allLocators });
        UI.renderResults(allLocators);

    } catch (error) {
        console.error('Generation failed:', error);
        Utils.showToast(`Error: ${error.message}`, 'error', 5000);
        UI.renderResults(allLocators);
    } finally {
        UI.showLoader(false);
    }
}

async function handleChatSend() {
    const query = DOM.chatInput.value.trim();
    if (!query || state.isChatting) return;
    if (!state.apiKey) {
        Utils.showToast('Please set your API key to use chat', 'error');
        return;
    }

    updateState({ isChatting: true });
    DOM.chatSendBtn.disabled = true;
    DOM.chatInput.value = '';
    UI.appendChatMessage(query, 'user');
    const thinkingMessage = UI.appendChatMessage('...', 'ai');

    try {
        const response = await AI.getChatResponse(query, DOM.htmlInput.value);
        thinkingMessage.remove();
        UI.appendChatMessage(response, 'ai');
    } catch (error) {
        thinkingMessage.remove();
        UI.appendChatMessage(`Sorry, an error occurred: ${error.message}`, 'ai');
    } finally {
        updateState({ isChatting: false });
        DOM.chatSendBtn.disabled = false;
    }
}

function handleFilterChange() {
    const filter = DOM.filterSelect.value;
    document.querySelectorAll('#output-content .locator-card').forEach(card => {
        let show = false;
        switch (filter) {
            case 'all': show = true; break;
            case 'ai': show = card.dataset.type === 'ai'; break;
            case 'rule': show = card.dataset.type === 'rule'; break;
            case 'css': show = card.dataset.kind === 'css'; break;
            case 'xpath': show = card.dataset.kind === 'xpath'; break;
        }
        card.style.display = show ? 'block' : 'none';
    });
}

function loadSettings() {
    const savedKey = localStorage.getItem('gemini-api-key');
    const savedModel = localStorage.getItem('selected-model');
    if (savedKey) {
        updateState({ apiKey: savedKey });
        DOM.apiKeyInput.value = savedKey;
        UI.updateApiStatus(true);
    }
    if (savedModel) {
        updateState({ selectedModel: savedModel });
        DOM.modelSelect.value = savedModel;
    }
}

async function init() {
    await initDB();
    loadSettings();

    // Setup all event listeners
    DOM.settingsBtn.addEventListener('click', () => UI.openModal(DOM.settingsModal));
    DOM.closeModalBtn.addEventListener('click', () => UI.closeModal(DOM.settingsModal));
    DOM.cancelSettingsBtn.addEventListener('click', () => UI.closeModal(DOM.settingsModal));
    DOM.saveSettingsBtn.addEventListener('click', handleSettingsSave);

    DOM.chatBubble.addEventListener('click', () => UI.openModal(DOM.chatModal));
    DOM.closeChatModalBtn.addEventListener('click', () => UI.closeModal(DOM.chatModal));
    DOM.chatSendBtn.addEventListener('click', handleChatSend);
    DOM.chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
    });

    DOM.generateBtn.addEventListener('click', handleGenerateClick);
    DOM.clearBtn.addEventListener('click', () => { DOM.htmlInput.value = ''; UI.clearOutput(); });
    DOM.formatBtn.addEventListener('click', () => { DOM.htmlInput.value = Utils.formatHtml(DOM.htmlInput.value); });
    DOM.filterSelect.addEventListener('change', handleFilterChange);

    if (!DOM.htmlInput.value.trim()) {
        const sampleHtml = `<form>\n  <h2>Login</h2>\n  <input type="email" id="email" name="user_email" placeholder="Enter your email">\n  <button data-testid="submit-btn">Submit</button>\n</form>`;
        DOM.htmlInput.value = sampleHtml;
    }

    Utils.showToast('Locator Generator is ready!', 'success', 3000);
}

document.addEventListener('DOMContentLoaded', init);
