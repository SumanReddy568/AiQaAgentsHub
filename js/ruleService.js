// js/ruleService.js

export function generateRuleBasedLocators(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = doc.body.querySelectorAll('input, button, a, select, textarea, [role], h1, h2, h3, label');
    const locators = [];
    const seenLocators = new Set();

    const addLocator = (details) => {
        if (details.locator && !seenLocators.has(details.locator)) {
            locators.push({ ...details, isAI: false });
            seenLocators.add(details.locator);
        }
    };

    elements.forEach((element) => {
        const tagName = element.tagName.toLowerCase();

        if (element.id) {
            addLocator({ locator: `#${element.id}`, type: 'CSS', priority: 'high', explanation: 'Unique ID selector.' });
        }

        ['data-testid', 'data-cy', 'data-test'].forEach(attr => {
            if (element.hasAttribute(attr)) {
                addLocator({ locator: `[${attr}='${element.getAttribute(attr)}']`, type: 'CSS', priority: 'high', explanation: `Test attribute: ${attr}.` });
            }
        });

        if (element.name) {
            addLocator({ locator: `${tagName}[name='${element.name}']`, type: 'CSS', priority: 'medium', explanation: 'Name attribute for form elements.' });
        }

        const text = element.textContent?.trim();
        if (text && text.length > 0 && text.length < 40) {
            const xpathText = `//${tagName}[normalize-space()="${text.replace(/"/g, "'")}"]`;
            addLocator({ locator: xpathText, type: 'XPath', priority: 'low', explanation: 'Text-based XPath locator.' });
        }
    });

    return locators;
}