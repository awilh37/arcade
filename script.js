// ===== API CONFIGURATION =====
const API_BASE_URL = 'http://localhost:5000';
let authToken = localStorage.getItem('arcade-token');

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
    displayName: 'Player'
};

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
    tokens: 1000,
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
    if (confirm('Are you sure you want to logout?')) {
        authState.isLoggedIn = false;
        authState.currentUser = null;
        authState.displayName = 'Player';
        authToken = null;
        localStorage.removeItem('arcade-token');
        closeAccountMenu();
        checkAuthStatus();
        showToast('Logged Out', 'See you next time!', 'info');
    }
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
                    time_taken: matchCardsElapsed || null
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

// Close modals when pressing Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            closeSettingsModal();
        }
    }
});

// Start the game on page load
window.addEventListener('load', init);
