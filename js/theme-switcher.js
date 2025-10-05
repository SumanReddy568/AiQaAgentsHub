/**
 * Theme Switcher for AI QA Agent Hub
 * Manages theme preferences and applies them across all pages
 */

document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const themeSwitch = document.getElementById('theme-switch');
    const themeRadioButtons = document.querySelectorAll('input[name="theme-preference"]');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Initialize theme
    initializeTheme();

    // Event listeners
    if (themeSwitch) {
        themeSwitch.addEventListener('change', function () {
            toggleTheme(themeSwitch.checked ? 'dark' : 'light');
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function () {
            const selectedTheme = document.querySelector('input[name="theme-preference"]:checked').value;
            saveThemePreference(selectedTheme);
        });
    }

    /**
     * Initialize theme based on saved preference or system preference
     */
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme_preference') || 'system';

        // Set radio button
        const radioToCheck = document.querySelector(`input[name="theme-preference"][value="${savedTheme}"]`);
        if (radioToCheck) {
            radioToCheck.checked = true;
        }

        // Apply theme
        applyTheme(savedTheme);
    }

    /**
     * Toggle between light and dark theme
     * @param {string} theme - 'light' or 'dark'
     */
    function toggleTheme(theme) {
        applyTheme(theme);

        // Update radio buttons if they exist
        const radioToCheck = document.querySelector(`input[name="theme-preference"][value="${theme}"]`);
        if (radioToCheck) {
            radioToCheck.checked = true;
        }

        // Save preference
        localStorage.setItem('theme_preference', theme);
    }

    /**
     * Save theme preference from settings modal
     * @param {string} preference - 'light', 'dark', or 'system'
     */
    function saveThemePreference(preference) {
        localStorage.setItem('theme_preference', preference);
        applyTheme(preference);
    }

    /**
     * Apply theme to document
     * @param {string} theme - 'light', 'dark', or 'system'
     */
    function applyTheme(theme) {
        if (theme === 'system') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            if (themeSwitch) {
                themeSwitch.checked = prefersDark;
            }
        } else {
            // Use explicit preference
            document.documentElement.setAttribute('data-theme', theme);
            if (themeSwitch) {
                themeSwitch.checked = theme === 'dark';
            }
        }
    }

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        const currentTheme = localStorage.getItem('theme_preference') || 'system';
        if (currentTheme === 'system') {
            applyTheme('system');
        }
    });
});
