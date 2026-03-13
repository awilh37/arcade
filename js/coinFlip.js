import { getSocket } from './socket.js';
import { showToast } from './ui.js';

let coinFlipState = {
    round: 0,
    accumulatedPoints: 0,
    accumulatedTokens: 0,
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
            accumulatedTokens: data.currentWinnings,
            guessing: true
        };

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('coinFlipScreen').classList.add('active');
        updateCoinFlipDisplay();
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
            coinFlipState.accumulatedTokens = data.totalTokensRecovered || coinFlipState.accumulatedTokens;

            // Show result
            messageEl.textContent = `✅ Correct! ${data.result.toUpperCase()} - You won ${data.pointsThisRound} points!`;
            messageEl.style.display = 'block';
            messageEl.style.color = 'var(--success-color)';

            // Show choices
            choiceMsg.innerHTML = `<strong>You have ${data.totalPoints} points and ${data.totalTokensRecovered} tokens recovered!</strong><br>Do you want to gamble more for a bigger reward?`;
            gambleBtn.style.display = 'block';
            gambleReward.textContent = `Bet 10 more tokens for ${data.nextPointsIfWin} points?`;

            choicesEl.classList.remove('hidden');

            // Disable guess buttons
            document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = true);
        } else {
            // Lost everything
            const totalLost = data.totalTokensLost;
            const finalPoints = data.totalPoints;

            messageEl.textContent = `❌ Incorrect! You guessed ${data.guess.toUpperCase()}, but it was ${data.result.toUpperCase()}`;
            messageEl.style.display = 'block';
            messageEl.style.color = 'var(--danger-color)';

            choiceMsg.innerHTML = `<strong>Game Over!</strong><br>You lost ${totalLost} tokens but earned ${finalPoints} points total.`;
            gambleBtn.style.display = 'none';

            choicesEl.classList.remove('hidden');

            // Disable guess buttons
            document.querySelectorAll('.guess-btn').forEach(btn => btn.disabled = true);
        }
    });

    socket.on('coin_flip_cashed_out', (data) => {
        showToast('Success', `Cashed out with ${data.totalPoints} points!`, 'success');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    });

    socket.on('error', (msg) => {
        if (msg.includes('coin') || msg.includes('guess')) {
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

    socket.emit('coin_flip_start');
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
    document.getElementById('coinFlipTokens').textContent = coinFlipState.accumulatedTokens;
    document.getElementById('coinFlipBet').textContent = '10';

    const nextRound = coinFlipState.round + 1;
    const pointsForNextRound = 20 * nextRound;
    document.getElementById('coinFlipRound').textContent = `Round ${nextRound}: Guess Correctly = ${pointsForNextRound} Points`;
}
