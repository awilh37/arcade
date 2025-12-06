// ===== API CONFIGURATION =====
const API_BASE_URL = 'https://arcade-w2f3.onrender.com';
let authToken = localStorage.getItem('arcade-token');

// ===== AUTHENTICATION UI CONTROLS =====

// Toggle between login and signup forms
function toggleSignup(event) {
    event.preventDefault();
    const loginSection = document.querySelector('.login-section');
    const signupSection = document.getElementById('signupSection');
    
    loginSection.classList.toggle('hidden');
    signupSection.classList.toggle('hidden');
}

// Handle signup
async function handleSignup(event) {
    event.preventDefault();

    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const display_name = document.getElementById('signup-display-name').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, display_name })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast('Signup Failed', error.error || 'Could not create account', 'error');
            return;
        }

        const data = await response.json();
        authToken = data.token;
        localStorage.setItem('arcade-token', authToken);
        
        authState.isLoggedIn = true;
        authState.currentUser = data.user.username;
        authState.displayName = data.user.display_name;
        authState.role = data.user.role;
        gameState.tokens = data.user.tokens;
        gameState.points = data.user.points;
        
        checkAuthStatus();
        updateDisplay();
        showToast('Welcome!', `Account created as ${data.user.username}`, 'success');
        
        // Clear form
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-display-name').value = '';
    } catch (error) {
        console.error('Signup error:', error);
        showToast('Signup Failed', 'Connection error. Is the server running?', 'error');
    }
}

// ===== SHOP MODAL CONTROLS =====
function openShopModal() {
    const modal = document.getElementById('shopModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateShopCost();
    }
}

function closeShopModal() {
    const modal = document.getElementById('shopModal');
    if (modal) modal.classList.add('hidden');
}

function updateShopCost() {
    const amount = parseInt(document.getElementById('shopTokenAmount').value) || 0;
    const cost = amount * 10; // 10 points per token
    document.getElementById('shopCostDisplay').textContent = `Cost: ${cost} points`;
}

document.getElementById('shopTokenAmount')?.addEventListener('input', updateShopCost);

async function handleBuyTokens() {
    const amount = parseInt(document.getElementById('shopTokenAmount').value) || 0;
    const cost = amount * 10;
    if (amount < 1) {
        showToast('Invalid Amount', 'Enter at least 1 token.', 'warning');
        return;
    }
    if (gameState.points < cost) {
        showToast('Not Enough Points', 'You do not have enough points.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/shop/buy-tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ amount })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast('Error', error.error || 'Failed to buy tokens', 'error');
            return;
        }

        const data = await response.json();
        gameState.tokens = data.tokens;
        gameState.points = data.points;
        updateDisplay();
        showToast('Tokens Purchased', `Bought ${amount} tokens for ${cost} points.`, 'success');
        closeShopModal();
    } catch (error) {
        console.error('Buy tokens error:', error);
        showToast('Error', 'Failed to buy tokens', 'error');
    }
}
// Auth State
const authState = {
    isLoggedIn: false,
    currentUser: null,
    displayName: 'Player',
    role: 'player'
};

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Theme System
const themeSystem = {
    currentTheme: 'default',
    themes: {
        default: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            darkBg: '#0f172a',
            cardBg: '#1e293b',
            border: '#334155',
            textPrimary: '#f1f5f9',
            textSecondary: '#cbd5e1'
        },
        ocean: {
            primary: '#0ea5e9',
            secondary: '#06b6d4',
            darkBg: '#05232b',
            cardBg: '#07323a',
            border: '#114e59',
            textPrimary: '#e6f7fb',
            textSecondary: '#bfeef7'
        },
        sunset: {
            primary: '#f97316',
            secondary: '#ec4899',
            darkBg: '#2b0f0f',
            cardBg: '#3a1f1f',
            border: '#5a2318',
            textPrimary: '#fff4ee',
            textSecondary: '#ffd7c9'
        },
        forest: {
            primary: '#10b981',
            secondary: '#14b8a6',
            darkBg: '#072016',
            cardBg: '#0e3325',
            border: '#14583f',
            textPrimary: '#e9fff6',
            textSecondary: '#bff4de'
        },
        midnight: {
            primary: '#1e40af',
            secondary: '#3b82f6',
                darkBg: '#060618',
            cardBg: '#0f1724',
            border: '#1a2a5a',
            textPrimary: '#eef2ff',
            textSecondary: '#c7cffb'
        }
    },

    setTheme: function(themeName) {
        if (!this.themes[themeName]) {
            console.error('Theme not found:', themeName);
            return;
        }

        this.currentTheme = themeName;
        const theme = this.themes[themeName];

        // Update CSS variables for global theming
        const root = document.documentElement.style;
        root.setProperty('--primary-color', theme.primary);
        root.setProperty('--secondary-color', theme.secondary);
        root.setProperty('--dark-bg', theme.darkBg);
        root.setProperty('--card-bg', theme.cardBg);
        root.setProperty('--border-color', theme.border);
        root.setProperty('--text-primary', theme.textPrimary);
        root.setProperty('--text-secondary', theme.textSecondary);

        // Save to localStorage
        localStorage.setItem('arcade-theme', themeName);
        showToast('Theme Changed', `Switched to ${themeName}`, 'info', 2000);
    },

    loadTheme: function() {
        const saved = localStorage.getItem('arcade-theme');
        if (saved && this.themes[saved]) {
            this.setTheme(saved);
        }
    },

    getThemes: function() {
        return Object.keys(this.themes);
    }
};
// Game State
const gameState = {
    tokens: 100,
    points: 0,
    currentGame: null,
    currentWager: 0,
    gameResults: {
        wins: 0,
        losses: 0,
        totalPlayed: 0
    }
};

// Game Configurations
const games = {
    coinFlip: {
        name: 'Coin Flip',
        wager: 10,
        minWager: 5,
        maxWager: 500,
        winMultiplier: 2,
        pointsReward: 50
    },
    numberGuess: {
        name: 'Number Guess',
        wager: 10,
        minWager: 5,
        maxWager: 500,
        winMultiplier: 3,
        pointsReward: 100
    },
    reaction: {
        name: 'Reaction Time',
        wager: 15,
        minWager: 10,
        maxWager: 500,
        winMultiplier: 2.5,
        pointsReward: 75,
        targetTime: 400 // target reaction time in ms
    },
    matchCards: {
        name: 'Match Cards',
        wager: 20,
        minWager: 15,
        maxWager: 500,
        winMultiplier: 2.5,
        pointsReward: 150,
        pairs: 6 // number of card pairs
    }
};

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(title, message = '', type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close">×</button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    // Attach close handler so exit animation can run
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => {
                    if (toast.parentElement) toast.remove();
                }, 300);
            }
        });
    }
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                    toast.classList.add('removing');
                    setTimeout(() => {
                        if (toast.parentElement) {
                            toast.remove();
                        }
                    }, 300);
            }
        }, duration);
    }
    
    return toast;
}

// Initialize the game
function init() {
    updateDisplay();
    setupMatchCardsGame();
    checkAuthStatus();
    themeSystem.loadTheme();
}

// Check if user is logged in
function checkAuthStatus() {
    const landingPage = document.getElementById('landingPage');
    const mainPage = document.getElementById('mainPage');

    if (authState.isLoggedIn) {
        landingPage.classList.remove('active');
        mainPage.classList.add('active');
        updateUserDisplay();
        updateAdminMenuVisibility();
    } else {
        landingPage.classList.add('active');
        mainPage.classList.remove('active');
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast('Login Failed', error.error || 'Invalid credentials', 'error');
            return;
        }

        const data = await response.json();
        authToken = data.token;
        localStorage.setItem('arcade-token', authToken);
        
        authState.isLoggedIn = true;
        authState.currentUser = data.user.username;
        authState.displayName = data.user.display_name;
        authState.role = data.user.role;
        gameState.tokens = data.user.tokens;
        gameState.points = data.user.points;
        
        checkAuthStatus();
        updateDisplay();
        showToast('Welcome!', `Logged in as ${data.user.username}`, 'success');
        
        // Clear form
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login Failed', 'Connection error. Is the server running?', 'error');
    }
}

// Handle logout
function handleLogout() {
    openConfirm('Are you sure you want to logout?', async () => {
        authState.isLoggedIn = false;
        authState.currentUser = null;
        authState.displayName = 'Player';
        authState.role = 'player';
        authToken = null;
        localStorage.removeItem('arcade-token');
        closeAccountMenu();
        checkAuthStatus();
        showInAppMessage('Logged Out', 'See you next time!');
    });
}

// Toggle account menu
function toggleAccountMenu() {
    const menu = document.getElementById('accountMenu');
    menu.classList.toggle('hidden');
}

// Close account menu
function closeAccountMenu() {
    const menu = document.getElementById('accountMenu');
    menu.classList.add('hidden');
}

// Close account menu when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.querySelector('.account-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
        closeAccountMenu();
    }
});

// Open settings modal
function openSettingsModal(setting) {
    const modal = document.getElementById('settingsModal');
    const titleMap = {
        'displayName': 'Change Display Name',
        'username': 'Change Username',
        'password': 'Change Password'
    };

    document.getElementById('settingsTitle').textContent = titleMap[setting];
    document.getElementById('settingsLabel').textContent = 
        setting === 'displayName' ? 'New Display Name' :
        setting === 'username' ? 'New Username' : 'New Password';
    
    document.getElementById('settingsInput').type = setting === 'password' ? 'password' : 'text';
    document.getElementById('settingsInput').value = '';
    document.getElementById('settingsInput').placeholder = 
        setting === 'displayName' ? 'Enter display name' :
        setting === 'username' ? 'Enter new username' : 'Enter new password';

    // Store which setting is being changed
    modal.dataset.setting = setting;
    modal.classList.remove('hidden');
    closeAccountMenu();

    // Focus input
    setTimeout(() => document.getElementById('settingsInput').focus(), 100);
}

// Close settings modal
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('hidden');
}

// Theme modal controls
function openThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) modal.classList.remove('hidden');
}

function closeThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) modal.classList.add('hidden');
}

function selectTheme(themeName) {
    themeSystem.setTheme(themeName);
    closeThemeModal();
}

// Handle settings save
function handleSettingsSave(event) {
    event.preventDefault();

    const modal = document.getElementById('settingsModal');
    const setting = modal.dataset.setting;
    const newValue = document.getElementById('settingsInput').value.trim();

    if (!newValue) {
        showToast('Error', 'Please enter a value', 'warning');
        return;
    }

    // Update the setting
    switch(setting) {
        case 'displayName':
            authState.displayName = newValue;
            document.getElementById('displayName').textContent = newValue;
            showToast('Display Name Updated', `Changed to: ${newValue}`, 'success');
            break;
        case 'username':
            authState.currentUser = newValue;
            document.getElementById('menuUsername').textContent = newValue;
            showToast('Username Updated', `Changed to: ${newValue}`, 'success');
            break;
        case 'password':
            // In a real app, this would be hashed and sent to the server
            showToast('Password Updated', 'Your password has been changed', 'success');
            break;
    }

    closeSettingsModal();
}

// Update display with current user info
function updateUserDisplay() {
    if (authState.isLoggedIn) {
        document.getElementById('displayName').textContent = authState.displayName;
        document.getElementById('menuUsername').textContent = authState.currentUser;
    }
}

// Update UI displays
function updateDisplay() {
    document.getElementById('tokenDisplay').textContent = gameState.tokens;
    document.getElementById('pointsDisplay').textContent = gameState.points;
}

// Start a game
function startGame(gameName) {
    if (!games[gameName]) {
        console.error('Game not found:', gameName);
        return;
    }

    gameState.currentGame = gameName;
    const gameConfig = games[gameName];
    gameState.currentWager = gameConfig.wager;

    // Check if player has enough tokens
    if (gameState.tokens < gameState.currentWager) {
        showToast('Insufficient Tokens', `You need ${gameState.currentWager} tokens to play this game. You only have ${gameState.tokens}.`, 'error');
        return;
    }

    // Deduct wager from tokens
    gameState.tokens -= gameState.currentWager;
    updateDisplay();

    // Switch to game screen
    showScreen('gameScreen');
    document.getElementById('gameTitle').textContent = gameConfig.name;
    document.getElementById('wagerAmount').textContent = gameState.currentWager;

    // Show the correct game
    hideAllGameContent();
    const gameContent = document.getElementById(gameName + 'Game');
    if (gameContent) {
        gameContent.classList.remove('hidden');
    }

    // Reset game-specific UI
    document.getElementById(gameName + 'Result').textContent = '';
}

// Return to home screen
function returnHome() {
    showScreen('homeScreen');
    gameState.currentGame = null;
}

// Show/hide screens
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Hide all game content
function hideAllGameContent() {
    document.querySelectorAll('.game-content').forEach(content => {
        content.classList.add('hidden');
    });
}

// Show result modal and submit to backend
async function showResult(won, tokenChange, pointsChange) {
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
        gameState.gameResults.wins++;
    } else {
        resultIcon.textContent = '😢';
        resultTitle.textContent = 'You Lost!';
        resultMessage.textContent = 'Better luck next time!';
        resultTokenChange.textContent = '+0';
        resultTokenChange.style.color = 'var(--danger-color)';
        resultPointsChange.textContent = '+0';
        resultPointsChange.style.color = 'var(--danger-color)';
        gameState.gameResults.losses++;
    }

    gameState.gameResults.totalPlayed++;

    // Submit result to backend
    if (authToken && gameState.currentGame) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/game/result`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    game_name: gameState.currentGame,
                    won: won,
                    points_earned: pointsChange,
                    time_taken: matchCardsElapsed || null,
                    wager: gameState.currentWager
                })
            });

            if (response.ok) {
                const data = await response.json();
                gameState.tokens = data.user.tokens;
                gameState.points = data.user.points;
            } else {
                console.error('Failed to submit game result');
            }
        } catch (error) {
            console.error('Error submitting game result:', error);
        }
    } else {
        // Local update if no backend
        gameState.points += pointsChange;
    }

    updateDisplay();
    modal.classList.remove('hidden');
}

// Close result modal
function closeResult() {
    document.getElementById('resultModal').classList.add('hidden');
    returnHome();
}

// ===== COIN FLIP GAME =====
function playCoinFlip(choice) {
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;

    const resultElement = document.getElementById('coinFlipResult');
    if (won) {
        resultElement.innerHTML = `✨ You chose ${choice} and got ${result}! You earned ${games.coinFlip.pointsReward} points!`;
        resultElement.className = 'result-message win';
        showResult(true, 0, games.coinFlip.pointsReward);
    } else {
        resultElement.innerHTML = `❌ You chose ${choice} but got ${result}. You earned no points!`;
        resultElement.className = 'result-message lose';
        showResult(false, 0, 0);
    }
}

// ===== NUMBER GUESS GAME =====
function playNumberGuess(guess) {
    const secretNumber = Math.floor(Math.random() * 10) + 1;
    const won = guess === secretNumber;

    const resultElement = document.getElementById('numberGuessResult');
    if (won) {
        resultElement.innerHTML = `🎯 You guessed ${guess} and the number was ${secretNumber}! You earned ${games.numberGuess.pointsReward} points!`;
        resultElement.className = 'result-message win';
        showResult(true, 0, games.numberGuess.pointsReward);
    } else {
        resultElement.innerHTML = `❌ You guessed ${guess} but the number was ${secretNumber}. You earned no points!`;
        resultElement.className = 'result-message lose';
        showResult(false, 0, 0);
    }
}

// ===== REACTION TIME GAME =====
let reactionStartTime = null;
let reactionGameActive = false;

function startReactionGame() {
    const reactionBox = document.getElementById('reactionBox');
    const reactionResult = document.getElementById('reactionResult');
    const reactionStartBtn = document.getElementById('reactionStartBtn');

    reactionBox.textContent = 'Wait...';
    reactionBox.className = 'reaction-box';
    reactionResult.textContent = '';
    reactionStartBtn.disabled = true;
    reactionGameActive = false;

    const delay = Math.random() * 3000 + 2000; // 2-5 seconds
    const timeout = setTimeout(() => {
        reactionBox.textContent = 'CLICK NOW!';
        reactionBox.classList.add('active');
        reactionStartTime = Date.now();
        reactionGameActive = true;
        reactionBox.onclick = endReactionGame;
    }, delay);
}

function endReactionGame() {
    if (!reactionGameActive) return;

    reactionGameActive = false;
    const reactionTime = Date.now() - reactionStartTime;
    const reactionBox = document.getElementById('reactionBox');
    const reactionResult = document.getElementById('reactionResult');
    const reactionStartBtn = document.getElementById('reactionStartBtn');

    reactionBox.onclick = null;
    reactionBox.className = 'reaction-box';
    reactionBox.textContent = `${reactionTime}ms`;
    reactionStartBtn.disabled = false;

    const target = games.reaction.targetTime;
    const accuracy = Math.max(0, 100 - Math.abs(reactionTime - target) / 2);
    const won = accuracy > 50;

    if (won) {
        reactionResult.innerHTML = `⚡ Reaction time: ${reactionTime}ms! You earned ${games.reaction.pointsReward} points!`;
        reactionResult.className = 'result-message win';
        showResult(true, 0, games.reaction.pointsReward);
    } else {
        reactionResult.innerHTML = `❌ Reaction time: ${reactionTime}ms. Too slow or too fast! You earned no points!`;
        reactionResult.className = 'result-message lose';
        showResult(false, 0, 0);
    }
}

// ===== MATCH CARDS GAME =====
let matchCardsFlipped = [];
let matchCardsMatched = 0;
let matchCardsLocked = false;
let matchCardsStartTime = null;
let matchCardsTimerInterval = null;
let matchCardsElapsed = 0;

function setupMatchCardsGame() {
    const cardsGrid = document.getElementById('cardsGrid');
    const numPairs = games.matchCards.pairs;
    const allEmojis = ['🍕', '🍔', '🍟', '🌮', '🍜', '🍱', '🍩', '🍪'];
    const emojis = allEmojis.slice(0, numPairs);
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);

    matchCardsFlipped = [];
    matchCardsMatched = 0;
    matchCardsLocked = false;
    matchCardsElapsed = 0;
    matchCardsStartTime = Date.now();
    // Setup timer display
    let timerDisplay = document.getElementById('matchCardsTimer');
    if (!timerDisplay) {
        timerDisplay = document.createElement('div');
        timerDisplay.id = 'matchCardsTimer';
        timerDisplay.className = 'match-cards-timer';
        cardsGrid.parentElement.insertBefore(timerDisplay, cardsGrid);
    }
    timerDisplay.textContent = 'Time: 0.0s';
    if (matchCardsTimerInterval) clearInterval(matchCardsTimerInterval);
    matchCardsTimerInterval = setInterval(() => {
        matchCardsElapsed = (Date.now() - matchCardsStartTime) / 1000;
        timerDisplay.textContent = `Time: ${matchCardsElapsed.toFixed(1)}s`;
    }, 100);

    cardsGrid.innerHTML = '';
    cards.forEach((emoji, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.emoji = emoji;
        card.dataset.index = index;
        card.textContent = '?';
        card.onclick = () => flipMatchCard(card);
        cardsGrid.appendChild(card);
    });
}

// Flip a card (handles UI and match logic)
function flipMatchCard(card) {
    if (matchCardsLocked) return;
    if (!card || card.classList.contains('flipped') || card.classList.contains('matched')) return;

    // Flip visually and reveal emoji
    card.classList.add('flipped');
    card.textContent = card.dataset.emoji;

    matchCardsFlipped.push(card);

    if (matchCardsFlipped.length === 2) {
        // Lock to prevent further clicks until check completes
        matchCardsLocked = true;
        // Give a short delay so the player can see the second card
        setTimeout(() => {
            checkMatchCards();
        }, 500);
    }
}

function checkMatchCards() {
    const [card1, card2] = matchCardsFlipped;
    const isMatch = card1.dataset.emoji === card2.dataset.emoji;

    if (isMatch) {
        card1.classList.add('matched');
        card2.classList.add('matched');
        matchCardsMatched++;

        matchCardsFlipped = [];
        matchCardsLocked = false;

        if (matchCardsMatched === games.matchCards.pairs) {
            endMatchCardsGame(true);
        }
    } else {
        setTimeout(() => {
            card1.classList.remove('flipped');
            card1.textContent = '?';
            card2.classList.remove('flipped');
            card2.textContent = '?';
            matchCardsFlipped = [];
            matchCardsLocked = false;
        }, 1000);
    }
}

function endMatchCardsGame(won) {
    const resultElement = document.getElementById('matchCardsResult');
    matchCardsMatched = 0;
    if (matchCardsTimerInterval) clearInterval(matchCardsTimerInterval);
    let points = 0;
    if (won) {
        // Award more points for faster times (base: 150, minus 2 per second, min 50)
        points = Math.max(50, Math.round(150 - matchCardsElapsed * 2));
        resultElement.innerHTML = `🎊 You matched all the pairs!<br>Time: ${matchCardsElapsed.toFixed(1)}s<br>You earned ${points} points!`;
        resultElement.className = 'result-message win';
        showResult(true, 0, points);
    } else {
        resultElement.innerHTML = `You lost!`;
        resultElement.className = 'result-message lose';
        showResult(false, 0, 0);
    }
    setTimeout(() => setupMatchCardsGame(), 1200);
}

// ===== IN-MEMORY CHAT SYSTEM =====
let chatMessages = [];

async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/leaderboard`);
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        
        const players = await response.json();
        // Support both in-game modal and landing page
        const containers = [
            document.getElementById('leaderboardContainer'),
            document.getElementById('landingLeaderboard')
        ].filter(c => c !== null);
        
        if (containers.length === 0) return;
        
        if (players.length === 0) {
            const html = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">No players yet. Be the first!</p>';
            containers.forEach(c => c.innerHTML = html);
            return;
        }
        
        let html = '';
        players.slice(0, 50).forEach((player, index) => {
            let medal = '';
            let rankClass = '';
            if (index === 0) {
                medal = '🥇';
                rankClass = 'gold';
            } else if (index === 1) {
                medal = '🥈';
                rankClass = 'silver';
            } else if (index === 2) {
                medal = '🥉';
                rankClass = 'bronze';
            }
            
            html += `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${rankClass}">${medal || index + 1}</div>
                    <div class="leaderboard-player">
                        <div class="leaderboard-username">${escapeHtml(player.username)}</div>
                        <div class="leaderboard-display-name">${escapeHtml(player.display_name)}</div>
                    </div>
                    <div style="text-align: center; color: var(--text-secondary);">
                        <div style="font-size: 0.8rem;">${player.wins}W</div>
                    </div>
                    <div class="leaderboard-points">${player.points}</div>
                </div>
            `;
        });
        
        containers.forEach(c => c.innerHTML = html);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        const containers = [
            document.getElementById('leaderboardContainer'),
            document.getElementById('landingLeaderboard')
        ].filter(c => c !== null);
        const html = '<p style="text-align: center; color: var(--danger-color); padding: 1rem;">Failed to load leaderboard</p>';
        containers.forEach(c => c.innerHTML = html);
    }
}

function openLeaderboardModal() {
    const modal = document.getElementById('leaderboardModal');
    if (modal) {
        modal.classList.remove('hidden');
        loadLeaderboard();
    }
}

function closeLeaderboardModal() {
    const modal = document.getElementById('leaderboardModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function sendChatMessage(event) {
    event.preventDefault();
    
    // Check if user is muted
    if (authState.role === 'muted') {
        showToast('Muted', 'You are muted and cannot send messages', 'error');
        return;
    }
    
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    const currentUser = authState.displayName || authState.currentUser || 'Anonymous';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    chatMessages.push({
        username: currentUser,
        text: text,
        timestamp: timestamp,
        isOwn: true
    });
    
    input.value = '';
    renderChatMessages();
    
    // Auto-scroll to bottom
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (chatMessages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">No messages yet. Be the first to chat!</p>';
        return;
    }
    
    let html = '';
    chatMessages.forEach(msg => {
        const ownClass = msg.isOwn ? 'own' : '';
        html += `
            <div class="chat-message ${ownClass}">
                <div class="chat-username">${escapeHtml(msg.username)}</div>
                <div class="chat-text">${escapeHtml(msg.text)}</div>
                <div class="chat-timestamp">${msg.timestamp}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function openChatModal() {
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderChatMessages();
        const input = document.getElementById('chatInput');
        if (input) input.focus();
    }
}

function closeChatModal() {
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Close modals when pressing Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeLeaderboardModal();
        closeChatModal();
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            closeSettingsModal();
        }
    }
});

// Start the game on page load
window.addEventListener('load', function() {
    init();
    // Load landing leaderboard if on landing page
    setTimeout(() => {
        if (!authState.isLoggedIn) {
            loadLeaderboard();
        }
    }, 100);
});

// ===== ADMIN PANEL FUNCTIONS =====

// Update admin menu visibility based on role
function updateAdminMenuVisibility() {
    const adminSection = document.getElementById('adminMenuSection');
    if (adminSection) {
        if (authState.role === 'admin' || authState.role === 'owner') {
            adminSection.classList.remove('hidden');
        } else {
            adminSection.classList.add('hidden');
        }
    }
}

// Open admin panel
function openAdminPanel() {
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Clear search
        document.getElementById('adminSearchInput').value = '';
        document.getElementById('adminUsersList').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Enter a username to search for users</p>';
    }
}

// Close admin panel
function closeAdminPanel() {
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Search for users in admin panel
async function adminSearchUsers() {
    const searchInput = document.getElementById('adminSearchInput').value.trim();
    const usersList = document.getElementById('adminUsersList');

    if (!searchInput) {
        usersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Enter a username to search for users</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/search/${encodeURIComponent(searchInput)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            const error = await response.json();
            showToast('Error', error.error || 'Failed to search users', 'error');
            return;
        }

        const users = await response.json();

        if (users.length === 0) {
            usersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">No users found</p>';
            return;
        }

        usersList.innerHTML = users.map(user => `
            <div class="admin-user-card">
                <div class="admin-user-header">
                    <div class="admin-user-name">
                        <strong>${escapeHtml(user.username)}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">(${escapeHtml(user.display_name)})</span>
                    </div>
                    <span class="admin-role-badge ${user.role}">${user.role.toUpperCase()}</span>
                </div>
                <div class="admin-user-stats">
                    <div class="admin-user-stat">
                        <span>Tokens:</span>
                        <strong>${user.tokens}</strong>
                    </div>
                    <div class="admin-user-stat">
                        <span>Points:</span>
                        <strong>${user.points}</strong>
                    </div>
                    <div class="admin-user-stat">
                        <span>Joined:</span>
                        <strong>${new Date(user.created_at).toLocaleDateString()}</strong>
                    </div>
                </div>
                <div class="admin-user-actions">
                    <div class="admin-action-row">
                        <select class="admin-action-btn" id="roleSelect_${user.id}" style="background: var(--dark-bg); padding: 0.5rem;">
                            <option value="">Change Role...</option>
                            ${authState.role === 'owner' ? '<option value="owner">👑 Owner</option>' : ''}
                            <option value="admin">⚙️ Admin</option>
                            <option value="player">👤 Player</option>
                            <option value="muted">🔇 Muted</option>
                            <option value="banned">🚫 Banned</option>
                        </select>
                        <button class="admin-action-btn" onclick="adminChangeRole(${user.id}, 'roleSelect_${user.id}')">Apply</button>
                    </div>
                    <div class="admin-action-row">
                        <input type="number" id="tokenChange_${user.id}" placeholder="Tokens (±)" style="flex: 1; padding: 0.5rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 0.35rem; color: var(--text-primary);">
                        <input type="number" id="pointsChange_${user.id}" placeholder="Points (±)" style="flex: 1; padding: 0.5rem; background: var(--dark-bg); border: 1px solid var(--border-color); border-radius: 0.35rem; color: var(--text-primary);">
                        <button class="admin-action-btn success" onclick="adminModifyResources(${user.id})">Update</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Search error:', error);
        showToast('Error', 'Failed to search users', 'error');
    }
}

// Change user role
async function adminChangeRole(userId, selectId) {
    const select = document.getElementById(selectId);
    const newRole = select.value;

    if (!newRole) {
        showToast('Error', 'Please select a role', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/user/change-role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ targetUserId: userId, newRole })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast('Error', error.error || 'Failed to change role', 'error');
            return;
        }

        const result = await response.json();
        showToast('Success', `User role changed to ${newRole}`, 'success');
        
        // Refresh the search results
        setTimeout(() => adminSearchUsers(), 500);
    } catch (error) {
        console.error('Role change error:', error);
        showToast('Error', 'Failed to change role', 'error');
    }
}

// Modify user resources
async function adminModifyResources(userId) {
    const tokenInput = document.getElementById(`tokenChange_${userId}`);
    const pointsInput = document.getElementById(`pointsChange_${userId}`);

    const tokensChange = tokenInput.value ? parseInt(tokenInput.value) : undefined;
    const pointsChange = pointsInput.value ? parseInt(pointsInput.value) : undefined;

    if (!tokensChange && !pointsChange) {
        showToast('Error', 'Enter at least one value to modify', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/user/modify-resources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ targetUserId: userId, tokensChange, pointsChange })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast('Error', error.error || 'Failed to modify resources', 'error');
            return;
        }

        const result = await response.json();
        showToast('Success', 'User resources updated', 'success');
        
        // Refresh the search results
        setTimeout(() => adminSearchUsers(), 500);
    } catch (error) {
        console.error('Modify resources error:', error);
        showToast('Error', 'Failed to modify resources', 'error');
    }
}

// Update display to show admin menu when appropriate
const originalUpdateDisplay = window.updateDisplay;
window.updateDisplay = function() {
    if (originalUpdateDisplay) {
        originalUpdateDisplay.call(this);
    }
    updateAdminMenuVisibility();
};

// ===== Confirmation & In-App Message Helpers =====
function openConfirm(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.remove('hidden');

    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    function cleanup() {
        okBtn.removeEventListener('click', okHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        modal.classList.add('hidden');
    }

    function okHandler() {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    }

    function cancelHandler() {
        cleanup();
    }

    okBtn.addEventListener('click', okHandler);
    cancelBtn.addEventListener('click', cancelHandler);
}

function showInAppMessage(title, message) {
    const modal = document.getElementById('inAppModal');
    if (!modal) return;
    document.getElementById('inAppTitle').textContent = title;
    document.getElementById('inAppMessage').textContent = message;
    modal.classList.remove('hidden');
}

function closeInAppMessage() {
    const modal = document.getElementById('inAppModal');
    if (modal) modal.classList.add('hidden');
}

