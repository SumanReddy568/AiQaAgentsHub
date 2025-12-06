/**
 * Theme Switcher for AI QA Agent Hub
 * Manages theme preferences and applies them across all pages
 */

document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const themeSwitch = document.getElementById('theme-switch');
    const themeRadioButtons = document.querySelectorAll('input[name="theme-preference"]');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Check if current page is dashboard
    const isDashboardPage = window.location.pathname.includes('dashboard.html') ||
        window.location.pathname.endsWith('dashboard.html');

    // Initialize theme
    initializeTheme();

    // Event listeners - only add if not dashboard page
    if (themeSwitch && !isDashboardPage) {
        themeSwitch.addEventListener('change', function () {
            toggleTheme(themeSwitch.checked ? 'dark' : 'light');
        });
    }

    if (saveSettingsBtn && !isDashboardPage) {
        saveSettingsBtn.addEventListener('click', function () {
            const selectedTheme = document.querySelector('input[name="theme-preference"]:checked').value;
            saveThemePreference(selectedTheme);
        });
    }

    /**
     * Initialize theme based on saved preference or system preference
     */
    function initializeTheme() {
        // Force dark theme for dashboard page
        if (isDashboardPage) {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeSwitch) {
                themeSwitch.checked = true;
                themeSwitch.disabled = true; // Disable theme switch on dashboard
            }
            return;
        }

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
        // Skip theme toggle for dashboard page
        if (isDashboardPage) {
            return;
        }

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
        // Skip saving theme preference for dashboard page
        if (isDashboardPage) {
            return;
        }

        localStorage.setItem('theme_preference', preference);
        applyTheme(preference);
    }

    /**
     * Apply theme to document
     * @param {string} theme - 'light', 'dark', or 'system'
     */
    function applyTheme(theme) {
        // Force dark theme for dashboard page
        if (isDashboardPage) {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeSwitch) {
                themeSwitch.checked = true;
            }
            return;
        }


        if (theme === 'system') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

            // Toggle tailwind class
            if (prefersDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            if (themeSwitch) {
                themeSwitch.checked = prefersDark;
            }
        } else {
            // Use explicit preference
            document.documentElement.setAttribute('data-theme', theme);

            // Toggle tailwind class
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            if (themeSwitch) {
                themeSwitch.checked = theme === 'dark';
            }
        }
    }

    // Listen for system preference changes - skip for dashboard
    if (!isDashboardPage) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            const currentTheme = localStorage.getItem('theme_preference') || 'system';
            if (currentTheme === 'system') {
                applyTheme('system');
            }
        });
    }
});
