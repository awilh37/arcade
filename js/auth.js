import { apiCall, setAuthToken } from './api.js';
import { showToast } from './ui.js';

export let currentUser = null;

export async function login(username, password) {
    try {
        const data = await apiCall('/api/auth/login', 'POST', { username, password });
        if (data) {
            setAuthToken(data.token);
            currentUser = data.user;
            showToast('Success', `Welcome back, ${currentUser.display_name}!`, 'success');
            return true;
        }
    } catch (error) {
        showToast('Login Failed', error.message, 'error');
    }
    return false;
}

export async function register(username, email, password, display_name) {
    try {
        const data = await apiCall('/api/auth/register', 'POST', { 
            username, email, password, display_name 
        });
        if (data) {
            setAuthToken(data.token);
            currentUser = data.user;
            showToast('Success', 'Account created successfully!', 'success');
            return true;
        }
    } catch (error) {
        showToast('Registration Failed', error.message, 'error');
    }
    return false;
}

export function logout() {
    setAuthToken(null);
    currentUser = null;
    showToast('Logged Out', 'You have been logged out successfully.', 'info');
    window.location.reload();
}

export async function checkAuth() {
    try {
        const user = await apiCall('/api/user');
        if (user) {
            currentUser = user;
            return true;
        }
    } catch (error) {
        // Token might be invalid
        setAuthToken(null);
    }
    return false;
}

export function updateCurrentUser(user) {
    currentUser = user;
}
