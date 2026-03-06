import { apiCall } from '../api.js';
import { showToast } from '../ui.js';
import { updateDisplay } from '../main.js'; // We'll need to export this from main

export const coinFlipConfig = {
    name: 'Coin Flip',
    wager: 10,
    minWager: 5,
    maxWager: 500,
    winMultiplier: 2,
    pointsReward: 50
};

export async function playCoinFlip(choice, currentWager) {
    try {
        const response = await apiCall('/api/game/play', 'POST', {
            game_name: 'coinFlip',
            bet_amount: currentWager,
            bet_details: choice
        });

        if (!response) return null; // apiCall handles errors via toast/throw, but returns null on auth fail

        return {
            won: response.won,
            result: response.result_details.result,
            pointsEarned: response.points_earned,
            user: response.user
        };

    } catch (error) {
        showToast('Game Error', error.message, 'error');
        return null;
    }
}
