// js/main.js

import * as DOM from './dom.js';
import { state, updateState } from './state.js';
import * as UI from './ui.js';
import * as Rules from './ruleService.js';
import * as Utils from './utils.js';
import { initDB } from './db.js';
import { loadSettingsFromStorage } from './settings.js';
import { generateAiLocators } from "./agents/locatorGenAgent.js";
import { getChatResponse } from "./agents/chatAgent.js";
import { generateUsageExamples } from "./agents/usageGenAgent.js";

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
            const aiResults = await generateAiLocators(htmlContent);

            // This new block standardizes the AI data
            aiResults.forEach(rec => {
                const types = [
                    { key: 'cssSelector', type: 'CSS' },
                    { key: 'xpath', type: 'XPath' },
                    { key: 'id', type: 'ID' },
                    { key: 'name', type: 'Name' },
                    { key: 'tagName', type: 'TagName' },
                    { key: 'className', type: 'ClassName' },
                    { key: 'linkText', type: 'LinkText' },
                    { key: 'partialLinkText', type: 'PartialLinkText' }
                ];

                types.forEach(t => {
                    if (rec[t.key]) {
                        allLocators.push({
                            locator: rec[t.key],
                            type: t.type,
                            explanation: rec.explanation,
                            priority: (rec.priority && typeof rec.priority === 'string') ? rec.priority.toLowerCase() : 'medium',
                            isAI: true
                        });
                    }
                });
            });
        }

        updateState({ generatedLocators: allLocators });
        UI.renderResults(allLocators);

        // Enable the Generate Usage button if locators were generated
        if (allLocators.length > 0 && DOM.generateUsageBtn) {
            DOM.generateUsageBtn.disabled = false;
        }

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
        const response = await getChatResponse(query, DOM.htmlInput.value);
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

async function handleUsageGeneration(locators = null) {
    const locsToUse = locators || state.generatedLocators;
    
    if (!locsToUse || locsToUse.length === 0) {
        Utils.showToast('Generate locators first', 'warning');
        return;
    }

    const language = DOM.usageLanguage.value;
    const framework = DOM.usageFramework.value;
    const advanced = DOM.advancedUsage.checked;

    try {
        UI.showUsageLoader(true);
        const usageData = await generateUsageExamples(locsToUse, language, framework, advanced);
        UI.showUsageLoader(false);
        UI.renderUsageExamples(usageData, language, framework);
        Utils.showToast('Usage examples generated!', 'success');
    } catch (error) {
        console.error('Usage generation failed:', error);
        UI.showUsageLoader(false);
        Utils.showToast(`Failed to generate usage: ${error.message}`, 'error');
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

async function init() {
    loadSettingsFromStorage();
    await initDB();
    // loadSettings();

    // Setup all event listeners

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

    // Usage Generator button click handler
    if (DOM.generateUsageBtn) {
        DOM.generateUsageBtn.addEventListener('click', () => handleUsageGeneration());
    }

    if (!DOM.htmlInput.value.trim()) {
        const sampleHtml = `<form>\n  <h2>Login</h2>\n  <input type="email" id="email" name="user_email" placeholder="Enter your email">\n  <button data-testid="submit-btn">Submit</button>\n</form>`;
        DOM.htmlInput.value = sampleHtml;
    }

    Utils.showToast('Locator Generator is ready!', 'success', 3000);
}

document.addEventListener('DOMContentLoaded', init);
