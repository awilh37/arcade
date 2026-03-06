import { apiCall } from '../api.js';
import { showToast } from '../ui.js';

export const numberGuessConfig = {
    name: 'Number Guess',
    wager: 10,
    minWager: 5,
    maxWager: 500,
    winMultiplier: 3,
    pointsReward: 100
};

export async function playNumberGuess(guess, currentWager) {
    try {
        const response = await apiCall('/api/game/play', 'POST', {
            game_name: 'numberGuess',
            bet_amount: currentWager,
            bet_details: guess
        });

        if (!response) return null;

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
