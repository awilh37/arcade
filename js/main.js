import * as Config from './config.js';
import * as Auth from './auth.js';
import * as UI from './ui.js';
import { setupShop } from './shop.js';
import { setupLeaderboard } from './leaderboard.js';
import { setupChat } from './chat.js';
import { setupAdmin } from './admin.js';
import { initSocket } from './socket.js';
import { setupLobbyUI } from './lobby.js';
import { setupConnectFour } from './connectFour.js';
import { setupCoinFlip } from './coinFlip.js';

// Global Game State
export const gameState = {
    tokens: 1000,
    points: 0
};

// Expose Config/State to window for debugging/legacy
window.gameState = gameState;

// Initialization
async function init() {
    UI.setupModals();
    UI.themeSystem.loadTheme();
    setupShop();
    setupLeaderboard();
    setupChat();
    setupAdmin();

    // Check Auth
    const isAuthenticated = await Auth.checkAuth();
    if (isAuthenticated) {
        gameState.tokens = Auth.currentUser.tokens;
        gameState.points = Auth.currentUser.points;
        updateAuthUI(true);
        
        // Initialize Multiplayer
        const socket = initSocket();
        if (socket) {
            setupLobbyUI();
            setupConnectFour();
            setupCoinFlip();
        }
    } else {
        updateAuthUI(false);
    }
    
    updateDisplay();
    setupEventListeners();
}

function updateAuthUI(isLoggedIn) {
    const landingPage = document.getElementById('landingPage');
    const mainPage = document.getElementById('mainPage');
    const authBtn = document.getElementById('authBtn');

    if (isLoggedIn) {
        landingPage.classList.remove('active');
        mainPage.classList.add('active'); // Games Grid
        
        // Hide all screens first, then show games grid
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('gamesScreen').classList.add('active');
        
        // Header Updates
        document.getElementById('displayName').textContent = Auth.currentUser.display_name;
        document.querySelectorAll('.auth-only').forEach(el => el.classList.remove('hidden'));
        
        // Dropdown behavior
        authBtn.onclick = () => document.getElementById('accountMenu').classList.toggle('hidden');
    } else {
        landingPage.classList.add('active');
        mainPage.classList.remove('active');
        
        // Header Updates
        document.getElementById('displayName').textContent = 'Login';
        document.querySelectorAll('.auth-only').forEach(el => el.classList.add('hidden'));
        
        // Login Button behavior
        authBtn.onclick = () => UI.openLoginModal();
        document.getElementById('accountMenu').classList.add('hidden');
    }
}

export function updateDisplay() {
    document.getElementById('tokenDisplay').textContent = gameState.tokens;
    document.getElementById('pointsDisplay').textContent = gameState.points;
}

// Event Listeners Setup
function setupEventListeners() {
    // Login/Signup Forms
    document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('signupForm')?.addEventListener('submit', handleSignupSubmit);
    
    // Global Buttons
    document.getElementById('logoutBtn')?.addEventListener('click', Auth.logout);

    // Mobile Menu / Account Menu
    const accountBtn = document.querySelector('.account-btn');
    if (accountBtn) {
        accountBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // handled in updateAuthUI mostly, but if we need generic toggle:
        });
    }
}

// Form Handlers
async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (await Auth.login(username, password)) {
        gameState.tokens = Auth.currentUser.tokens;
        gameState.points = Auth.currentUser.points;
        updateAuthUI(true);
        updateDisplay();
        UI.closeLoginModal();
        
        // Initialize Socket on fresh login
        const socket = initSocket();
        if (socket) {
            setupLobbyUI();
            setupConnectFour();
            setupCoinFlip();
        }
    }
}

async function handleSignupSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const display_name = document.getElementById('signupDisplayName').value;

    if (await Auth.register(username, email, password, display_name)) {
        gameState.tokens = Auth.currentUser.tokens;
        gameState.points = Auth.currentUser.points;
        updateAuthUI(true);
        updateDisplay();
        UI.closeLoginModal();
        
        const socket = initSocket();
        if (socket) {
            setupLobbyUI();
            setupConnectFour();
            setupCoinFlip();
        }
    }
}

// Simple UI/Theme wrappers
window.selectTheme = (theme) => UI.themeSystem.setTheme(theme);
window.openThemeModal = () => document.getElementById('themeModal').classList.remove('hidden');
window.closeThemeModal = () => document.getElementById('themeModal').classList.add('hidden');

window.openShopModal = () => document.getElementById('shopModal').classList.remove('hidden');
window.closeShopModal = () => document.getElementById('shopModal').classList.add('hidden');

// Settings (Basic)
window.openSettingsModal = (type) => {
    document.getElementById('settingsModal').classList.remove('hidden');
    document.getElementById('settingsTitle').textContent = 'Settings';
};
window.closeSettingsModal = () => document.getElementById('settingsModal').classList.add('hidden');
window.toggleAccountMenu = () => document.getElementById('accountMenu').classList.toggle('hidden');
window.closeAccountMenu = () => document.getElementById('accountMenu').classList.add('hidden');

// Game Info & Lobby Handling
window.openGameInfo = (gameKey) => {
    let title = "Unknown Game";
    let desc = "Game details not available.";
    
    if (gameKey === 'connect_four') {
        title = "Connect Four";
        desc = "Strategic 2-player connection game. Drop discs to form a line of 4.";
    } else if (gameKey === 'coin_flip') {
        title = "Coin Flip";
        desc = "Fast-paced single-player gambling game. Bet 10 tokens per round, win points, and keep gambling for bigger rewards!";
    }
    
    UI.openGameInfoModal(gameKey, title, desc);
    // Trigger lobby list refresh for this game type? 
    // For now we just list all or filter client side.
};

// Global Exports
window.handleAuthClick = () => { /* Handled in updateAuthUI dynamic assignment */ };
window.handleLogout = Auth.logout;
window.handleSettingsSave = (e) => {
     e.preventDefault();
     /* Implement actual settings save if needed */
     UI.closeSettingsModal();
};

window.startCoinFlipFromModal = () => {
    document.getElementById('gameInfoModal').classList.add('hidden');
    window.startCoinFlipGame?.();
};

window.openLeaderboardModal = () => document.getElementById('leaderboardModal').classList.remove('hidden');
window.closeLeaderboardModal = () => document.getElementById('leaderboardModal').classList.add('hidden');

document.addEventListener('DOMContentLoaded', init);
