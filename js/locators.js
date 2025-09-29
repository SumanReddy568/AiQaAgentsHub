// js/locators.js

// Contains the core logic for rule-based locator generation.

export function generateRuleBasedLocators(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = doc.body.querySelectorAll('*');
    const locators = [];
    const seenLocators = new Set();

    elements.forEach((element) => {
        const tagName = element.tagName.toLowerCase();

        // Add locators based on ID (high priority)
        if (element.id) {
            const cssId = `#${element.id}`;
            if (!seenLocators.has(cssId)) {
                locators.push({ locator: cssId, type: 'CSS', priority: 'high', explanation: 'Unique ID selector - most reliable.' });
                seenLocators.add(cssId);
            }
        }

        // Add locators based on test-specific attributes
        ['data-testid', 'data-cy', 'data-test'].forEach(attr => {
            if (element.hasAttribute(attr)) {
                const value = element.getAttribute(attr);
                const cssAttr = `[${attr}='${value}']`;
                if (!seenLocators.has(cssAttr)) {
                    locators.push({ locator: cssAttr, type: 'CSS', priority: 'high', explanation: `Test attribute selector - highly stable.` });
                    seenLocators.add(cssAttr);
                }
            }
        });

        // Add locators based on name attribute (medium priority)
        if (element.name) {
            const cssName = `${tagName}[name='${element.name}']`;
            if (!seenLocators.has(cssName)) {
                locators.push({ locator: cssName, type: 'CSS', priority: 'medium', explanation: 'Name attribute is good for form elements.' });
                seenLocators.add(cssName);
            }
        }

        // Add XPath locator based on text content (low priority)
        const text = element.textContent?.trim();
        if (text && text.length < 30 && ['button', 'a', 'span', 'h1', 'h2'].includes(tagName)) {
            const xpathText = `//${tagName}[normalize-space(text())='${text.replace(/'/g, "\\'")}']`;
            if (!seenLocators.has(xpathText)) {
                locators.push({ locator: xpathText, type: 'XPath', priority: 'low', explanation: 'Text-based locator, can be brittle.' });
                seenLocators.add(xpathText);
            }
        }
    });

    return locators;
}