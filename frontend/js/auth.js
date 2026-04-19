/**
 * Authentication Management File
 * Purpose: Handle user authentication (login, register, logout, session management)
 * This file works with api.js for backend communication
 */

// ============================================
// DOM ELEMENTS (Will be populated when page loads)
// ============================================

let authContainer = null;
let userInfoContainer = null;

// ============================================
// INITIALIZE AUTH ON PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Setup auth containers if they exist
    setupAuthContainers();
    
    // Setup login form if on login page
    setupLoginForm();
    
    // Setup register form if on register page
    setupRegisterForm();
});

// ============================================
// SETUP AUTH CONTAINERS
// ============================================

function setupAuthContainers() {
    // For navbar user display
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        const user = api.getCurrentUser();
        if (user.name) {
            userNameSpan.innerHTML = `👤 ${user.name}`;
        }
    }
}

// ============================================
// CHECK AUTH STATUS
// ============================================

function checkAuthStatus() {
    const isLoggedIn = api.isLoggedIn();
    const currentPath = window.location.pathname;
    
    // Pages that require authentication
    const protectedPages = ['passenger.html', 'driver.html', 'admin.html'];
    const isProtectedPage = protectedPages.some(page => currentPath.includes(page));
    
    // Login and register pages (redirect if already logged in)
    const authPages = ['login.html', 'register.html'];
    const isAuthPage = authPages.some(page => currentPath.includes(page));
    
    if (isProtectedPage && !isLoggedIn) {
        // Not logged in, redirect to login page
        sessionStorage.setItem('redirectAfterLogin', currentPath);
        window.location.href = 'login.html';
    } else if (isAuthPage && isLoggedIn) {
        // Already logged in, redirect to appropriate dashboard
        const user = api.getCurrentUser();
        if (user.role === 'driver') {
            window.location.href = 'driver.html';
        } else if (user.role === 'passenger') {
            window.location.href = 'passenger.html';
        } else {
            window.location.href = 'index.html';
        }
    }
}

// ============================================
// SETUP LOGIN FORM
// ============================================

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
        });
    }
    
    // Enter key press on password field
    const passwordField = document.getElementById('password');
    if (passwordField) {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
}

// ============================================
// HANDLE LOGIN
// ============================================

async function handleLogin() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn?.innerText || 'Login';
    
    // Validate inputs
    if (!email || !password) {
        api.showAlert('Please enter both email and password', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        api.showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    // Show loading state
    if (loginBtn) {
        loginBtn.innerText = 'Logging in...';
        loginBtn.disabled = true;
    }
    
    try {
        const result = await api.loginUser({ email, password });
        
        if (result.success) {
            // Save to localStorage
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            api.showAlert('Login successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
                sessionStorage.removeItem('redirectAfterLogin');
                
                if (redirectUrl && !redirectUrl.includes('login') && !redirectUrl.includes('register')) {
                    window.location.href = redirectUrl;
                } else if (result.user.role === 'driver') {
                    window.location.href = 'driver.html';
                } else if (result.user.role === 'passenger') {
                    window.location.href = 'passenger.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 1000);
        } else {
            api.showAlert(result.message || 'Login failed. Please check your credentials.', 'error');
            if (loginBtn) {
                loginBtn.innerText = originalText;
                loginBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        api.showAlert('Network error. Please try again.', 'error');
        if (loginBtn) {
            loginBtn.innerText = originalText;
            loginBtn.disabled = false;
        }
    }
}

// ============================================
// SETUP REGISTER FORM
// ============================================

function setupRegisterForm() {
    const registerBtn = document.getElementById('registerBtn');
    const roleSelect = document.getElementById('role');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    
    // Show/hide driver info based on role selection
    if (roleSelect) {
        roleSelect.addEventListener('change', toggleDriverInfo);
        // Trigger on load
        toggleDriverInfo();
    }
    
    // Check URL for pre-selected role (from index.html)
    const urlParams = new URLSearchParams(window.location.search);
    const preferredRole = urlParams.get('role') || localStorage.getItem('preferredRole');
    if (preferredRole && roleSelect) {
        roleSelect.value = preferredRole;
        toggleDriverInfo();
        localStorage.removeItem('preferredRole');
    }
}

// ============================================
// TOGGLE DRIVER INFO SECTION
// ============================================

function toggleDriverInfo() {
    const roleSelect = document.getElementById('role');
    const driverInfo = document.getElementById('driverInfo');
    
    if (roleSelect && driverInfo) {
        if (roleSelect.value === 'driver') {
            driverInfo.style.display = 'block';
        } else {
            driverInfo.style.display = 'none';
        }
    }
}

// ============================================
// HANDLE REGISTER
// ============================================

async function handleRegister() {
    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const role = document.getElementById('role')?.value || 'passenger';
    const registerBtn = document.getElementById('registerBtn');
    const originalText = registerBtn?.innerText || 'Register';
    
    // Validate all fields
    if (!name || !email || !phone || !password || !confirmPassword) {
        api.showAlert('Please fill in all fields', 'error');
        return;
    }
    
    // Validate name length
    if (name.length < 3) {
        api.showAlert('Name must be at least 3 characters long', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        api.showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    // Validate phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
        api.showAlert('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        api.showAlert('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Check if passwords match
    if (password !== confirmPassword) {
        api.showAlert('Passwords do not match', 'error');
        return;
    }
    
    // Show loading state
    if (registerBtn) {
        registerBtn.innerText = 'Creating account...';
        registerBtn.disabled = true;
    }
    
    try {
        const result = await api.registerUser({ name, email, phone, password, role });
        
        if (result.success) {
            // Save to localStorage
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            api.showAlert('Registration successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                if (result.user.role === 'driver') {
                    window.location.href = 'driver.html';
                } else {
                    window.location.href = 'passenger.html';
                }
            }, 1500);
        } else {
            api.showAlert(result.message || 'Registration failed. Please try again.', 'error');
            if (registerBtn) {
                registerBtn.innerText = originalText;
                registerBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        api.showAlert('Network error. Please try again.', 'error');
        if (registerBtn) {
            registerBtn.innerText = originalText;
            registerBtn.disabled = false;
        }
    }
}

// ============================================
// LOGOUT FUNCTION
// ============================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        api.logoutUser();
    }
}

// ============================================
// GET CURRENT USER (Synchronous)
// ============================================

function getCurrentUser() {
    return api.getCurrentUser();
}

// ============================================
// CHECK IF USER IS DRIVER
// ============================================

function isDriver() {
    const user = getCurrentUser();
    return user.role === 'driver';
}

// ============================================
// CHECK IF USER IS PASSENGER
// ============================================

function isPassenger() {
    const user = getCurrentUser();
    return user.role === 'passenger';
}

// ============================================
// CHECK IF USER IS ADMIN
// ============================================

function isAdmin() {
    const user = getCurrentUser();
    return user.role === 'admin';
}

// ============================================
// GET AUTH HEADER FOR API CALLS
// ============================================

function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? `Bearer ${token}` : null;
}

// ============================================
// REFRESH USER SESSION
// ============================================

async function refreshUserSession() {
    const result = await api.getUserProfile();
    if (result.success && result.user) {
        const currentUser = getCurrentUser();
        const updatedUser = { ...currentUser, ...result.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
    }
    return null;
}

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================

window.auth = {
    checkAuthStatus,
    handleLogin,
    handleRegister,
    logout,
    getCurrentUser,
    isDriver,
    isPassenger,
    isAdmin,
    getAuthHeader,
    refreshUserSession,
    toggleDriverInfo
};