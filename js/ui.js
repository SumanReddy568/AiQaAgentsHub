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

export function showUsageLoader(isGenerating) {
    if (!DOM.usageDisplayContainer) return;

    if (isGenerating) {
        DOM.usageDisplayContainer.classList.remove('hidden');
        DOM.usageDisplayContainer.innerHTML = `
            <div class="p-4 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                <div class="flex flex-col items-center justify-center py-4">
                    <div class="relative flex items-center justify-center mb-3" style="width:48px;height:48px;">
                        <span class="absolute inset-0 rounded-full border-4 border-purple-400 border-t-transparent animate-spin"></span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="relative z-10">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                    </div>
                    <div class="text-sm font-bold text-purple-700 text-center">
                        Generating code examples...
                    </div>
                    <p class="text-xs text-slate-600 mt-1">Creating usage snippets</p>
                </div>
            </div>`;
    } else {
        // Don't hide, just clear the loader (content will be replaced)
    }
}

export function clearOutput() {
    DOM.outputContent.innerHTML = '';
    DOM.outputContent.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    DOM.exportBtn.disabled = true;
    
    // Disable Generate Usage button when clearing
    if (DOM.generateUsageBtn) {
        DOM.generateUsageBtn.disabled = true;
    }
}

function createLocatorCard({ locator, type, explanation, priority, isAI }) {
    const card = document.createElement('div');
    card.className = 'locator-card p-4 rounded-xl border bg-white/80 fade-in';
    card.dataset.type = isAI ? 'ai' : 'rule';
    card.dataset.kind = type.toLowerCase();

    const getBadgeColor = (t) => {
        const colors = {
            css: 'bg-blue-100 text-blue-800',
            xpath: 'bg-purple-100 text-purple-800',
            id: 'bg-red-100 text-red-800',
            name: 'bg-green-100 text-green-800',
            linktext: 'bg-yellow-100 text-yellow-800',
            partiallinktext: 'bg-orange-100 text-orange-800',
            tagname: 'bg-indigo-100 text-indigo-800',
            classname: 'bg-teal-100 text-teal-800'
        };
        return colors[t.toLowerCase()] || 'bg-gray-100 text-gray-800';
    };

    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2 flex-wrap">
                ${isAI
                            ? `<span class="inline-flex items-center px-2 py-1 rounded-full bg-white">
                            <img src="assets/ai.png" alt="AI" class="w-4 h-4 rounded-full mr-1" />
                        </span>`
                            : `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">Rule</span>`
                }
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getBadgeColor(type)}">${type}</span>
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

export function renderUsageExamples(usageData, language, framework) {
    if (!DOM.usageDisplayContainer) return;

    DOM.usageDisplayContainer.classList.remove('hidden');
    
    let html = `
        <div class="p-3 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl max-h-96 overflow-y-auto custom-scrollbar">
            <div class="mb-2">
                <h3 class="text-sm font-bold text-slate-800 flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    ${language} - ${framework}
                </h3>
            </div>`;

    // Basic Examples
    if (usageData.basicExamples && usageData.basicExamples.length > 0) {
        html += `<div class="mb-3">
            <h4 class="text-xs font-semibold text-slate-700 mb-1">📝 Basic Examples</h4>
            <div class="space-y-2">`;
        
        usageData.basicExamples.forEach((example, idx) => {
            html += `
                <div class="bg-white rounded-lg p-2 shadow-sm">
                    <div class="flex items-center justify-between mb-1">
                        <h5 class="text-xs font-semibold text-slate-800">${escapeHtml(example.title)}</h5>
                        <button class="copy-code-btn text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded" data-code="${escapeHtml(example.code)}">
                            Copy
                        </button>
                    </div>
                    <pre class="code-block p-2 rounded-lg overflow-x-auto text-xs"><code>${escapeHtml(example.code)}</code></pre>
                    <p class="text-xs text-slate-600 mt-1">${escapeHtml(example.description)}</p>
                </div>`;
        });
        
        html += `</div></div>`;
    }

    // Advanced Examples
    if (usageData.advancedExamples && usageData.advancedExamples.length > 0) {
        html += `<div class="mb-3">
            <h4 class="text-xs font-semibold text-slate-700 mb-1">🚀 Advanced Patterns</h4>
            <div class="space-y-2">`;
        
        usageData.advancedExamples.forEach((example, idx) => {
            html += `
                <div class="bg-white rounded-lg p-2 shadow-sm border-l-2 border-purple-400">
                    <div class="flex items-center justify-between mb-1">
                        <h5 class="text-xs font-semibold text-slate-800">${escapeHtml(example.title)}</h5>
                        <button class="copy-code-btn text-xs px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded" data-code="${escapeHtml(example.code)}">
                            Copy
                        </button>
                    </div>
                    <pre class="code-block p-2 rounded-lg overflow-x-auto text-xs"><code>${escapeHtml(example.code)}</code></pre>
                    <p class="text-xs text-slate-600 mt-1">${escapeHtml(example.description)}</p>
                </div>`;
        });
        
        html += `</div></div>`;
    }

    // Best Practices
    if (usageData.bestPractices && usageData.bestPractices.length > 0) {
        html += `<div class="bg-green-50 rounded-lg p-2 border border-green-200">
            <h4 class="text-xs font-semibold text-green-800 mb-1">✅ Best Practices</h4>
            <ul class="list-disc list-inside space-y-0.5 text-xs text-slate-700">`;
        
        usageData.bestPractices.forEach(practice => {
            html += `<li>${escapeHtml(practice)}</li>`;
        });
        
        html += `</ul></div>`;
    }

    html += `</div>`;
    
    DOM.usageDisplayContainer.innerHTML = html;

    // Add event listeners for copy buttons
    DOM.usageDisplayContainer.querySelectorAll('.copy-code-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-code');
            copyToClipboard(code, btn);
        });
    });
}