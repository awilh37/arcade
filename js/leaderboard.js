import { apiCall } from './api.js';
import { showToast } from './ui.js';

export function setupLeaderboard() {
    window.openLeaderboardModal = openLeaderboardModal;
    window.closeLeaderboardModal = closeLeaderboardModal;
    
    // Load leaderboard when landing page loads
    loadLeaderboard('landingLeaderboard');
}

async function loadLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading...</p>';

    try {
        const data = await apiCall('/api/leaderboard');
        if (!data || !Array.isArray(data)) {
            container.innerHTML = '<p style="text-align: center;">No data available</p>';
            return;
        }

        container.innerHTML = '';
        data.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            // Add medal for top 3
            let rankDisplay = `<span class="rank">${index + 1}</span>`;
            if (index === 0) rankDisplay = `<span class="rank medal">🥇</span>`;
            if (index === 1) rankDisplay = `<span class="rank medal">🥈</span>`;
            if (index === 2) rankDisplay = `<span class="rank medal">🥉</span>`;

            item.innerHTML = `
                <div class="rank-info">
                    ${rankDisplay}
                    <span class="username">${user.display_name || user.username}</span>
                </div>
                <div class="score-info">
                    <span class="points">${user.points.toLocaleString()} pts</span>
                </div>
            `;
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Leaderboard error:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--danger-color);">Failed to load leaderboard</p>';
    }
}

function openLeaderboardModal() {
    document.getElementById('leaderboardModal').classList.remove('hidden');
    loadLeaderboard('leaderboardContainer');
}

function closeLeaderboardModal() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}
