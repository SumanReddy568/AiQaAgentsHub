// js/utils.js

import * as DOM from './dom.js';

export function formatHtml(html) {
    let indent = 0;
    const tab = '  ';
    const formatted = html.replace(/></g, '>\n<');
    const lines = formatted.split('\n');
    const result = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.match(/^<\//)) indent = Math.max(0, indent - 1);
        result.push(tab.repeat(indent) + trimmed);
        if (trimmed.match(/^<[^\/]/) && !trimmed.match(/\/$/) && !trimmed.startsWith('<!')) {
            indent++;
        }
    });
    return result.join('\n');
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function copyToClipboard(text, button) {
    const originalContent = button.innerHTML;
    navigator.clipboard.writeText(text).then(() => {
        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>`;
        showToast('Copied!', 'success', 1500);
        setTimeout(() => { button.innerHTML = originalContent; }, 1500);
    }).catch(() => showToast('Failed to copy', 'error'));
}

export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warning: 'bg-yellow-500' };
    toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg transform -translate-x-full transition-transform duration-300`;
    toast.innerHTML = `<span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.remove('-translate-x-full'), 100);
    setTimeout(() => {
        toast.classList.add('-translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function extractJsonFromResponse(content) {
    const match = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.error("Failed to parse JSON from code block", e);
            throw new Error('AI response was not valid JSON.');
        }
    }
    throw new Error('No JSON block found in the AI response.');
}