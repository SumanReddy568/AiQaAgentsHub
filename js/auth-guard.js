import './auth.js';

/**
 * Auth Guard
 * Protects pages from unauthorized access.
 */
function checkAuth() {
    const auth = window.AuthModule;
    if (auth && !auth.isAuthenticated()) {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        console.warn(`Access denied to ${currentPage}. Redirecting to login...`);

        // Save the intended destination to redirect back after login (optional enhancement)
        localStorage.setItem('redirect_after_login', currentPage);

        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Run immediately if possible, or on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}

// Also export if needed
export default checkAuth;
