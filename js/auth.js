/**
 * Authentication Module for AI QA Agent Hub
 * Integrates with Cloudflare Auth Worker API
 */

// Configuration
const AUTH_CONFIG = {
    API_BASE_URL: 'https://auth-worker.sumanreddy568.workers.dev',
    SOURCE: 'ai-qa-agents-hub',
    STORAGE_KEYS: {
        TOKEN: 'auth_token',
        USER_EMAIL: 'user_email',
        USER_HASH: 'user_hash',
        USER_NAME: 'user_name'
    },
    REDIRECT_TARGET: 'index.html'
};

/**
 * Utility Functions
 */

// Generate SHA-256 hash from email and password
async function generateHash(email, password) {
    const text = `${email.toLowerCase()}:${password}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Show error message
function showError(message, elementId = 'error-message') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        const span = errorElement.querySelector('span');
        if (span) span.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
}

// Show success message
function showSuccess(message, elementId = 'success-message') {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        const span = successElement.querySelector('span');
        if (span) span.textContent = message;
        successElement.classList.remove('hidden');
        setTimeout(() => {
            successElement.classList.add('hidden');
        }, 3000);
    }
}

// Toggle button loading state
function setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
        const text = button.querySelector('.button-text');
        const loader = button.querySelector('.button-loader');
        const icon = button.querySelector('i');

        if (isLoading) {
            button.disabled = true;
            if (text) text.classList.add('hidden');
            if (loader) loader.classList.remove('hidden');
            if (icon) icon.classList.add('hidden');
        } else {
            button.disabled = false;
            if (text) text.classList.remove('hidden');
            if (loader) loader.classList.add('hidden');
            if (icon) icon.classList.remove('hidden');
        }
    }
}

// Store authentication data
function storeAuthData(token, email, hash, name = '') {
    localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER_EMAIL, email);
    localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER_HASH, hash);
    if (name) {
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER_NAME, name);
    }
}

// Clear authentication data
function clearAuthData() {
    localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER_EMAIL);
    localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER_HASH);
    localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER_NAME);
}

// Get stored token
function getStoredToken() {
    return localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN);
}

// Get stored email
function getStoredEmail() {
    return localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER_EMAIL);
}

// Get stored name
function getStoredName() {
    return localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER_NAME);
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getStoredToken();
}

/**
 * API Functions
 */

// Get user location and network details
async function getUserDetails() {
    try {
        const response = await fetch('https://ipwho.is/');
        if (!response.ok) return {};
        const data = await response.json();
        return {
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country,
            isp: data.connection?.isp || data.isp,
            timezone: data.timezone?.id
        };
    } catch (error) {
        console.warn('Failed to fetch user details:', error);
        return {};
    }
}

// Signup API call
async function signup(email, password, name) {
    try {
        const hash = await generateHash(email, password);
        const userDetails = await getUserDetails();

        const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: AUTH_CONFIG.SOURCE,
                hash: hash,
                email: email,
                password: password,
                name: name,
                ...userDetails
            })
        });

        if (response.status === 409) {
            throw new Error('An account with this email already exists.');
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error('Server error: Invalid response format.');
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Server error: Invalid response format.');
        }

        if (!response.ok) {
            if (Array.isArray(data) && data.length > 0) data = data[0];
            const errorText = data.error?.message || data.error || data.message || 'Signup failed.';
            throw new Error(errorText);
        }

        return { success: true, hash, email, name };
    } catch (error) {
        throw error;
    }
}

// Login API call
async function login(email, password) {
    try {
        const hash = await generateHash(email, password);

        const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: AUTH_CONFIG.SOURCE,
                hash: hash
            })
        });

        if (response.status === 401) {
            throw new Error('Invalid email or password.');
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error('Server error: Invalid response format.');
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Server error: Invalid response format.');
        }

        if (!response.ok) {
            if (Array.isArray(data) && data.length > 0) data = data[0];
            const errorText = data.error?.message || data.error || data.message || 'Login failed.';
            throw new Error(errorText);
        }

        return {
            success: true,
            token: data.token,
            hash,
            email,
            name: data.user?.name || ''
        };
    } catch (error) {
        throw error;
    }
}

// Validate session API call
async function validateSession() {
    try {
        const token = getStoredToken();
        if (!token) return { valid: false };

        const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/me?source=${AUTH_CONFIG.SOURCE}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return { valid: false };

        const data = await response.json();
        return { valid: data.valid };
    } catch (error) {
        return { valid: false };
    }
}

/**
 * Page Initialization Functions
 */

function initPasswordToggles() {
    const toggles = [
        { btn: 'toggle-password', input: 'password' },
        { btn: 'toggle-signup-password', input: 'signup-password' }
    ];

    toggles.forEach(({ btn, input }) => {
        const btnEl = document.getElementById(btn);
        const inputEl = document.getElementById(input);
        if (btnEl && inputEl) {
            btnEl.addEventListener('click', () => {
                const type = inputEl.type === 'password' ? 'text' : 'password';
                inputEl.type = type;
                const icon = btnEl.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                }
            });
        }
    });
}

function initFormToggles() {
    const showSignup = document.getElementById('show-signup');
    const showLogin = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const title = document.getElementById('form-title');
    const subtitle = document.getElementById('form-subtitle');

    if (showSignup && showLogin && loginForm && signupForm) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            if (title) title.textContent = 'Create Account';
            if (subtitle) subtitle.textContent = 'Join the AI QA Hub community';
        });

        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            if (title) title.textContent = 'Welcome Back';
            if (subtitle) subtitle.textContent = 'Please sign in to your account';
        });
    }
}

function initLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        setButtonLoading('login-btn', true);
        try {
            const result = await login(email, password);
            if (result.success) {
                storeAuthData(result.token, result.email, result.hash, result.name);
                showSuccess('Login successful! Redirecting...');
                setTimeout(() => {
                    window.location.href = AUTH_CONFIG.REDIRECT_TARGET;
                }, 1000);
            }
        } catch (error) {
            showError(error.message);
            setButtonLoading('login-btn', false);
        }
    });
}

function initSignup() {
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) return;

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!name || !email || !password || !confirmPassword) {
            showError('Please fill in all fields.');
            return;
        }

        if (password.length < 8) {
            showError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }

        setButtonLoading('signup-btn', true);
        try {
            const result = await signup(email, password, name);
            if (result.success) {
                showSuccess('Account created! Logging you in...');
                // Auto-login
                const loginResult = await login(email, password);
                if (loginResult.success) {
                    storeAuthData(loginResult.token, loginResult.email, loginResult.hash, loginResult.name);
                    setTimeout(() => {
                        window.location.href = AUTH_CONFIG.REDIRECT_TARGET;
                    }, 1500);
                }
            }
        } catch (error) {
            showError(error.message);
            setButtonLoading('signup-btn', false);
        }
    });
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    // Only run on login page
    if (document.getElementById('login-form') || document.getElementById('signup-form')) {
        initPasswordToggles();
        initFormToggles();
        initLogin();
        initSignup();
    }
});

// Export Module
window.AuthModule = {
    isAuthenticated,
    getStoredEmail,
    getStoredName,
    getStoredToken,
    validateSession,
    logout: () => {
        clearAuthData();
        window.location.href = 'login.html';
    }
};
