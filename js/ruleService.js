// js/ruleService.js

export function generateRuleBasedLocators(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = doc.body.querySelectorAll('input, button, a, select, textarea, [role], h1, h2, h3, h4, h5, h6, label, img, span, div[class*="button"], div[class*="btn"]');
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

        if (element.hasAttribute('role') && !['presentation', 'none'].includes(element.getAttribute('role'))) {
            addLocator({ locator: `${tagName}[role='${element.getAttribute('role')}']`, type: 'CSS', priority: 'medium', explanation: 'Role attribute for accessibility.' });
        }

        if (element.hasAttribute('aria-label')) {
            addLocator({ locator: `${tagName}[aria-label='${element.getAttribute('aria-label')}']`, type: 'CSS', priority: 'medium', explanation: 'Aria-label for accessibility.' });
        }

        if (element.name) {
            addLocator({ locator: `${tagName}[name='${element.name}']`, type: 'CSS', priority: 'medium', explanation: 'Name attribute for form elements.' });
        }

        if (['input', 'textarea'].includes(tagName) && element.hasAttribute('placeholder')) {
            addLocator({ locator: `${tagName}[placeholder='${element.getAttribute('placeholder')}']`, type: 'CSS', priority: 'low', explanation: 'Placeholder attribute.' });
        }

        if (tagName === 'a' && element.hasAttribute('href')) {
            addLocator({ locator: `a[href='${element.getAttribute('href')}']`, type: 'CSS', priority: 'low', explanation: 'Href attribute for links.' });
        }

        if (tagName === 'img' && element.hasAttribute('alt')) {
            addLocator({ locator: `img[alt='${element.getAttribute('alt')}']`, type: 'CSS', priority: 'low', explanation: 'Alt text for images.' });
        }

        if (tagName === 'label' && element.hasAttribute('for')) {
            addLocator({ locator: `label[for='${element.getAttribute('for')}']`, type: 'CSS', priority: 'low', explanation: 'For attribute of a label.' });
        }

        if (element.hasAttribute('title')) {
            addLocator({ locator: `${tagName}[title='${element.getAttribute('title')}']`, type: 'CSS', priority: 'low', explanation: 'Title attribute.' });
        }

        const text = element.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
            const escapedText = text.replace(/"/g, "'");
            const xpathText = `//${tagName}[normalize-space()="${escapedText}"]`;
            addLocator({ locator: xpathText, type: 'XPath', priority: 'low', explanation: 'Text-based XPath locator (exact match).' });

            if (text.length > 5) {
                const xpathContainsText = `//${tagName}[contains(normalize-space(), "${escapedText}")]`;
                addLocator({ locator: xpathContainsText, type: 'XPath', priority: 'low', explanation: 'Text-based XPath locator (contains).' });
            }
        }
    });

    return locators;
}