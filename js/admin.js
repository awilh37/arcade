import { apiCall } from './api.js';
import { showToast } from './ui.js';

export function setupAdmin() {
    window.openAdminPanel = openAdminPanel;
    window.closeAdminPanel = closeAdminPanel;
    window.adminSearchUsers = adminSearchUsers;
}

function openAdminPanel() {
    document.getElementById('adminPanelModal').classList.remove('hidden');
}

function closeAdminPanel() {
    document.getElementById('adminPanelModal').classList.add('hidden');
}

async function adminSearchUsers() {
    const query = document.getElementById('adminSearchInput').value;
    // Implementation placeholder - would call /api/admin/users/search
    showToast('Admin', 'Search functionality coming soon', 'info');
}
