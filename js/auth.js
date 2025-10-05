const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');

// Toggle between login and signup forms
showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Handle login
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({
                type: 'login',
                email,
                password
            })
        });

        const data = await response.json();
        if (data.success) {
            localStorage.setItem('user_token', data.token);
            window.location.href = '/index.html';
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});

// Handle signup
document.getElementById('signup-btn').addEventListener('click', async () => {
    const name = document.getElementById('name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const response = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({
                type: 'signup',
                name,
                email,
                password
            })
        });

        const data = await response.json();
        if (data.success) {
            localStorage.setItem('user_token', data.token);
            window.location.href = '/index.html';
        } else {
            alert(data.message || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed. Please try again.');
    }
});
