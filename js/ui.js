// js/ui.js

import * as DOM from './dom.js';
import { escapeHtml, copyToClipboard } from './utils.js';

const showdownConverter = new showdown.Converter();

export function openModal(modal) {
    modal.classList.remove('invisible', 'opacity-0');
    modal.querySelector('.modal-content').classList.remove('scale-95');
}

export function closeModal(modal) {
    modal.classList.add('invisible', 'opacity-0');
    modal.querySelector('.modal-content').classList.add('scale-95');
}

export function updateApiStatus(isConnected) {
    DOM.apiStatus.classList.toggle('hidden', !isConnected);
}

export function showLoader(isGenerating) {
    DOM.crazyLoader.classList.toggle('hidden', !isGenerating);
    DOM.emptyState.classList.add('hidden');
    DOM.outputContent.classList.toggle('hidden', isGenerating);
    DOM.generateBtn.disabled = isGenerating;
    DOM.generateBtn.innerHTML = isGenerating
        ? `<span class="flex items-center justify-center space-x-2">Generating...</span>`
        : `<span class="flex items-center justify-center space-x-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"></polygon></svg><span>Generate Locators</span></span>`;
}

export function clearOutput() {
    DOM.outputContent.innerHTML = '';
    DOM.outputContent.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    DOM.exportBtn.disabled = true;
}

function createLocatorCard({ locator, type, explanation, priority, isAI }) {
    const card = document.createElement('div');
    card.className = 'locator-card p-4 rounded-xl border bg-white/80 fade-in';
    card.dataset.type = isAI ? 'ai' : 'rule';
    card.dataset.kind = type.toLowerCase();

    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${isAI ? 'bg-pink-100 text-pink-800' : 'bg-slate-100 text-slate-800'}">${isAI ? 'AI' : 'Rule'}</span>
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${type === 'CSS' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">${type}</span>
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${priority === 'high' ? 'bg-green-100 text-green-800' : priority === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}">${priority}</span>
            </div>
            <button class="copy-btn p-2 rounded-lg hover:bg-slate-100" title="Copy locator">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
        </div>
        <div class="code-block p-3 mb-2 overflow-x-auto"><code class="text-sm font-mono whitespace-pre-wrap break-all">${escapeHtml(locator)}</code></div>
        <p class="text-sm text-slate-600">${escapeHtml(explanation)}</p>`;
    card.querySelector('.copy-btn').addEventListener('click', () => copyToClipboard(locator, card.querySelector('.copy-btn')));
    return card;
}

export function renderResults(locators) {
    clearOutput();
    if (locators.length === 0) return;

    DOM.emptyState.classList.add('hidden');
    DOM.outputContent.classList.remove('hidden');

    locators.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

    locators.forEach(loc => {
        DOM.outputContent.appendChild(createLocatorCard(loc));
    });

    DOM.exportBtn.disabled = false;
}

export function appendChatMessage(text, sender) {
    const messageDiv = document.createElement('div');
    const isUser = sender === 'user';
    messageDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} fade-in`;
    const content = isUser ? escapeHtml(text) : showdownConverter.makeHtml(text);

    messageDiv.innerHTML = `
        <div class="p-3 rounded-xl max-w-[80%] ${isUser ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}">${content}</div>`;
    DOM.chatHistory.appendChild(messageDiv);
    DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
    return messageDiv;
}