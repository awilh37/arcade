import { getSocket } from './socket.js';
import { showToast } from './ui.js';

let coinFlipState = {
    round: 0,
    accumulatedPoints: 0,
    tokensSpent: 0,
    guessing: false
};

export function setupCoinFlip() {
    const socket = getSocket();
    if (!socket) return;

    // Socket event handlers
    socket.on('coin_flip_ready', (data) => {
        console.log('Coin flip ready:', data);
        coinFlipState = {
            round: data.round,
            accumulatedPoints: data.pointsWinnings,
            tokensSpent: 0,
            guessing: true
        };

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('coinFlipScreen').classList.add('active');
        updateCoinFlipDisplay();
    });

    // Listen for lobby_joined to trigger coin flip start
    socket.on('lobby_joined', (data) => {
        console.log('Joined lobby for coin flip:', data);
        if (data.gameType === 'coin_flip') {
            // Hide the lobby room (in case lobby.js tries to show it)
            document.getElementById('lobbyRoom').classList.remove('active');
            // Auto-start coin flip game
            setTimeout(() => {
                socket.emit('coin_flip_start');
            }, 500);
        }
    });

    socket.on('coin_flip_result', (data) => {
        console.log('Coin flip result:', data);
        coinFlipState.guessing = false;

        const messageEl = document.getElementById('coinFlipMessage');
        const choicesEl = document.getElementById('coinFlipChoices');
        const choiceMsg = document.getElementById('choiceMessage');
        const gambleBtn = document.getElementById('gambleMoreBtn');
        const gambleReward = document.getElementById('gambleReward');

        if (data.won) {
            // Update state
            coinFlipState.round = data.round || (coinFlipState.round + 1);
            coinFlipState.accumulatedPoints = data.totalPoints;
            coinFlipState.tokensSpent = data.totalTokensSpent;
            coinFlipState.guessing = false;

            // Show result
            messageEl.textContent = `✅ Correct! ${data.result.toUpperCase()} - You won ${data.pointsThisRound} points this round.`;
            messageEl.style.display = 'block';
            messageEl.style.color = 'var(--success-color)';

            // Show choices
            choiceMsg.innerHTML = `<strong>You have ${data.totalPoints} points and have spent ${data.totalTokensSpent} tokens.</strong><br>Do you want to gamble more for a bigger reward?`;
            gambleBtn.style.display = 'block';
            gambleReward.textContent = `Bet 10 more tokens for ${data.nextPotentialPoints} points total?`;

            choicesEl.classList.remove('hidden');
            document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = true);
            updateCoinFlipDisplay();

        } else {
            // Lost everything
            const totalLost = data.totalTokensLost;

            messageEl.textContent = `❌ Incorrect! You guessed ${data.guess.toUpperCase()}, but it was ${data.result.toUpperCase()}`;
            messageEl.style.display = 'block';
            messageEl.style.color = 'var(--danger-color)';

            choiceMsg.innerHTML = `<strong>Game Over!</strong><br>You lost ${totalLost} tokens and scored 0 points this run.`;
            gambleBtn.style.display = 'none';

            choicesEl.classList.remove('hidden');
            document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = true);

            // Show final result modal and return to menu shortly
            window.showResultModal(false, -totalLost, 0, 'All-or-nothing loss - better luck next time.');
            setTimeout(() => {
                document.getElementById('resultModal').classList.add('hidden');
                window.leaveLobby();
            }, 3000);
        }
    });

    socket.on('coin_flip_cashed_out', (data) => {
        const tokensMoved = data.totalTokensSpent ? -data.totalTokensSpent : 0;
        window.showResultModal(true, tokensMoved, data.totalPoints, data.message || 'Cashed out successfully.');

        // Return to game select after result screen
        setTimeout(() => {
            document.getElementById('resultModal').classList.add('hidden');
            window.leaveLobby();
        }, 3000);
    });

    socket.on('error', (msg) => {
        if (msg.includes('coin') || msg.includes('guess') || msg.includes('lobby')) {
            showToast('Error', msg, 'error');
            coinFlipState.guessing = false;
        }
    });
}

export function startCoinFlip() {
    const socket = getSocket();
    if (!socket) {
        showToast('Error', 'Not connected to server', 'error');
        return;
    }

    if (!socket.connected) {
        showToast('Error', 'Connecting to server... Please try again', 'error');
        return;
    }

    // Create a single-player lobby for coin flip
    console.log('Creating coin flip lobby...');
    socket.emit('lobby_create', { 
        name: 'Coin Flip Game',
        gameType: 'coin_flip' 
    });
}

// Global alias for HTML onclick
window.startCoinFlipGame = startCoinFlip;

window.coinFlipGuess = (guess) => {
    const socket = getSocket();
    if (!socket) {
        showToast('Error', 'Not connected to server', 'error');
        return;
    }

    if (!coinFlipState.guessing) {
        showToast('Wait', 'Please wait for the result...', 'warning');
        return;
    }

    coinFlipState.guessing = false;

    // Disable buttons during flip
    document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = true);

    // Animate coin flip
    const coin = document.getElementById('coinFlipCoin');
    coin.style.animation = 'none';
    setTimeout(() => {
        coin.style.animation = 'spin 0.6s ease-out';
    }, 10);

    // Send guess to server
    socket.emit('coin_flip_guess', { guess });
};

window.coinFlipGambleMore = () => {
    // Reset UI for next round
    document.getElementById('coinFlipMessage').style.display = 'none';
    document.getElementById('coinFlipChoices').classList.add('hidden');
    document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = false);

    // Show next round info
    coinFlipState.guessing = true;
    updateCoinFlipDisplay();
};

window.coinFlipCashOut = () => {
    const socket = getSocket();
    if (!socket) {
        showToast('Error', 'Not connected to server', 'error');
        return;
    }

    socket.emit('coin_flip_cash_out');
};

function updateCoinFlipDisplay() {
    document.getElementById('coinFlipPoints').textContent = coinFlipState.accumulatedPoints;
    document.getElementById('coinFlipTokens').textContent = coinFlipState.tokensSpent;
    document.getElementById('coinFlipBet').textContent = '10';

    const nextRound = coinFlipState.round + 1;
    const pointsForNextRound = nextRound === 1 ? 20 : (nextRound === 2 ? 10 : nextRound * 10);
    const totalIfWin = coinFlipState.accumulatedPoints + pointsForNextRound;
    document.getElementById('coinFlipRound').textContent = `Round ${nextRound}: Bet 10 for ${pointsForNextRound} points (total possible ${totalIfWin})`;
}
