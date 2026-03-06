import { THEME_KEY } from './config.js';

// Toast Notification
export function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-header">
            <strong>${title}</strong>
            <small>Just now</small>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// Theme System
export const themeSystem = {
    currentTheme: 'default',
    themes: {
        default: {
            '--primary-color': '#6366f1',
            '--secondary-color': '#4f46e5',
            '--background-color': '#0f172a',
            '--surface-color': '#1e293b',
            '--text-color': '#f8fafc',
            '--text-muted': '#94a3b8',
            '--accent-color': '#8b5cf6',
            '--success-color': '#10b981',
            '--danger-color': '#ef4444',
            '--warning-color': '#f59e0b',
            '--border-color': '#334155'
        },
        ocean: {
            '--primary-color': '#0ea5e9',
            '--secondary-color': '#0284c7',
            '--background-color': '#0c4a6e',
            '--surface-color': '#075985',
            '--text-color': '#f0f9ff',
            '--text-muted': '#bae6fd',
            '--accent-color': '#38bdf8',
            '--success-color': '#34d399',
            '--danger-color': '#f87171',
            '--warning-color': '#fbbf24',
            '--border-color': '#0369a1'
        },
        forest: {
            '--primary-color': '#22c55e',
            '--secondary-color': '#16a34a',
            '--background-color': '#14532d',
            '--surface-color': '#166534',
            '--text-color': '#f0fdf4',
            '--text-muted': '#bbf7d0',
            '--accent-color': '#4ade80',
            '--success-color': '#86efac',
            '--danger-color': '#f87171',
            '--warning-color': '#fcd34d',
            '--border-color': '#15803d'
        },
        sunset: {
            '--primary-color': '#f97316',
            '--secondary-color': '#ea580c',
            '--background-color': '#431407',
            '--surface-color': '#7c2d12',
            '--text-color': '#fff7ed',
            '--text-muted': '#fed7aa',
            '--accent-color': '#fb923c',
            '--success-color': '#84cc16',
            '--danger-color': '#ef4444',
            '--warning-color': '#fde047',
            '--border-color': '#9a3412'
        },
        monochrome: {
            '--primary-color': '#f8fafc',
            '--secondary-color': '#e2e8f0',
            '--background-color': '#000000',
            '--surface-color': '#171717',
            '--text-color': '#ffffff',
            '--text-muted': '#a3a3a3',
            '--accent-color': '#d4d4d4',
            '--success-color': '#22c55e',
            '--danger-color': '#ef4444',
            '--warning-color': '#eab308',
            '--border-color': '#404040'
        }
    },

    setTheme(themeName) {
        if (!this.themes[themeName]) return;
        
        const root = document.documentElement;
        const theme = this.themes[themeName];
        
        Object.entries(theme).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        this.currentTheme = themeName;
        localStorage.setItem(THEME_KEY, themeName);

        // Update active state in theme selector
        document.querySelectorAll('.theme-button').forEach(btn => {
            // Check if onclick matches or use another way. simple check:
            // btn.classList.toggle('active', ...);
        });
    },

    loadTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY) || 'default';
        this.setTheme(savedTheme);
    }
};

// Modal System
export function setupModals() {
    // Close modal on outside click
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    };

    // Close buttons
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(closeBtn => {
        closeBtn.onclick = function() {
            const modal = this.closest('.modal');
            if (modal) modal.classList.add('hidden');
        };
    });
}


export function showResultModal(won, pointsChange) {
    const modal = document.getElementById('resultModal');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const resultTokenChange = document.getElementById('resultTokenChange');
    const resultPointsChange = document.getElementById('resultPointsChange');

    if (won) {
        resultIcon.textContent = '🎉';
        resultTitle.textContent = 'You Won!';
        resultMessage.textContent = pointsChange > 0 ? `You earned ${pointsChange} points!` : 'You earned no points.';
        resultTokenChange.textContent = '+0';
        resultTokenChange.style.color = 'var(--success-color)';
        resultPointsChange.textContent = `+${pointsChange}`;
        resultPointsChange.style.color = 'var(--success-color)';
    } else {
        resultIcon.textContent = '😢';
        resultTitle.textContent = 'You Lost!';
        resultMessage.textContent = 'Better luck next time!';
        resultTokenChange.textContent = '+0'; // Tokens already deducted
        resultTokenChange.style.color = 'var(--danger-color)';
        resultPointsChange.textContent = '+0';
        resultPointsChange.style.color = 'var(--danger-color)';
    }

    modal.classList.remove('hidden');
}


// --- Auth Modals ---
export function openLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
}

export function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
}

export function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginBtn = document.getElementById('showLoginBtn');
    const signupBtn = document.getElementById('showSignupBtn');
    const title = document.getElementById('authTitle');

    if (mode === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        loginBtn.classList.add('active');
        signupBtn.classList.remove('active');
        title.textContent = 'Login';
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        loginBtn.classList.remove('active');
        signupBtn.classList.add('active');
        title.textContent = 'Create Account';
    }
}

// --- Game Info Modal ---
export function openGameInfoModal(gameId, title, desc) {
    document.getElementById('infoGameTitle').innerText = title;
    document.getElementById('infoGameDesc').innerText = desc;
    document.getElementById('gameInfoModal').classList.remove('hidden');
    // Store current gameId for lobby creation
    window.currentGameType = gameId; 
}

export function closeGameInfoModal() {
    document.getElementById('gameInfoModal').classList.add('hidden');
}

// --- Lobby Room UI ---
export function showLobbyRoom(lobby) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('lobbyRoom').classList.add('active');
    
    document.getElementById('lobbyRoomName').textContent = lobby.name;
    document.getElementById('lobbyGameType').textContent = lobby.gameType || 'Connect Four';
    
    updateLobbyStatus('Waiting for players...');
}

export function updateLobbyStatus(status) {
    document.getElementById('lobbyStatusText').textContent = status;
}

export function leaveLobbyRoom() {
    document.getElementById('lobbyRoom').classList.remove('active');
    document.getElementById('gamesScreen').classList.add('active');
}

// Add these to window for HTML onclick access
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.switchAuthMode = switchAuthMode;
window.closeGameInfoModal = closeGameInfoModal;
