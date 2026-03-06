import { apiCall } from './api.js';
import { showToast } from './ui.js';
import { gameState, updateDisplay } from './main.js';

export function setupShop() {
    const input = document.getElementById('shopTokenAmount');
    if (input) {
        input.addEventListener('input', updateShopCost);
    }
    
    document.getElementById('buyTokensBtn')?.addEventListener('click', handleBuyTokens);
}

function updateShopCost() {
    const amount = parseInt(document.getElementById('shopTokenAmount').value) || 0;
    const cost = amount * 10; // 10 points per token
    document.getElementById('shopCostDisplay').textContent = `Cost: ${cost} points`;
}

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
        const response = await apiCall('/api/shop/buy-tokens', 'POST', { amount });
        
        if (response && response.success) {
            gameState.tokens = response.tokens;
            gameState.points = response.points;
            updateDisplay();
            showToast('Tokens Purchased', `Bought ${amount} tokens for ${cost} points.`, 'success');
            document.getElementById('shopModal').classList.add('hidden');
        }
    } catch (error) {
        showToast('Error', error.message || 'Failed to buy tokens', 'error');
    }
}
