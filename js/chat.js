import { showToast } from './ui.js';

export function setupChat() {
    window.openChatModal = openChatModal;
    window.closeChatModal = closeChatModal;
    window.sendChatMessage = sendChatMessage;
}

function openChatModal() {
    document.getElementById('chatModal').classList.remove('hidden');
    // In a real app, we'd fetch messages here
}

function closeChatModal() {
    document.getElementById('chatModal').classList.add('hidden');
}

function sendChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message) {
        // Simulate sending
        const container = document.getElementById('chatMessages');
        const msgEl = document.createElement('div');
        msgEl.textContent = `You: ${message}`;
        msgEl.style.padding = '0.5rem';
        msgEl.style.borderBottom = '1px solid var(--border-color)';
        container.appendChild(msgEl);
        
        input.value = '';
        showToast('Message Sent', 'Your message has been posted', 'success');
    }
}
