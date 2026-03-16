import { getSocket } from './socket.js';
import { showToast, showLobbyRoom, leaveLobbyRoom, updateLobbyStatus } from './ui.js';
import { currentUser } from './auth.js';

let currentLobbyId = null;
let amIHost = false;
let lobbyUISetup = false; // Prevent duplicate setup

export function setupLobbyUI() {
    const socket = getSocket();
    if (!socket) {
        console.warn('Socket not available for lobby UI setup');
        return;
    }
    
    // Prevent duplicate setup
    if (lobbyUISetup) {
        console.warn('Lobby UI already set up');
        return;
    }
    lobbyUISetup = true;
    
    // reset state
    currentLobbyId = null;
    amIHost = false;

    const infoLobbyList = document.getElementById('infoLobbyList');
    
    // Host Controls
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
             socket.emit('game_start_req'); 
        });
    }

    // Handle Updates
    socket.on('lobby_update', (lobbies) => {
        console.log('Received lobby_update:', lobbies);
        renderLobbyList(lobbies); 
    });
    
    socket.on('lobby_joined', (data) => {
        showToast('Success', `Joined lobby: ${data.name}`, 'success');

        currentLobbyId = data.lobbyId;
        amIHost = data.isHost;

        // Hide Game Info Modal
        document.getElementById('gameInfoModal').classList.add('hidden');

        if (data.gameType === 'coin_flip') {
            // Coin flip handles its own game screen; do not show shared lobby screen.
            return;
        }

        // Show Lobby Room
        showLobbyRoom(data);
        renderLobbyPlayers(data.players || []);
    });
    
    socket.on('lobby_player_update', (players) => {
        console.log('Received lobby_player_update:', players);
        renderLobbyPlayers(players);
    });

    socket.on('lobby_kicked', () => {
        showToast('Info', 'You have been kicked from the lobby.', 'info');
        teardownLobby();
    });
    
    socket.on('lobby_closed', () => {
        showToast('Info', 'Host closed the lobby.', 'info');
        teardownLobby();
    });

    socket.on('game_start', () => {
        // Handled in connectFour.js but we should hide lobby room
        document.getElementById('lobbyRoom').classList.remove('active');
    });

    socket.on('error', (msg) => {
        console.error('Socket error:', msg);
        showToast('Error', msg, 'error');
    });

    // Join Handler
    if (infoLobbyList) {
        infoLobbyList.addEventListener('click', (e) => {
            if (e.target.classList.contains('join-btn')) {
                const lobbyId = e.target.dataset.id;
                console.log('Joining lobby:', lobbyId);
                socket.emit('lobby_join', lobbyId);
            }
        });
    }
    
    console.log('Lobby UI setup complete');
}

// Global Exports
window.createLobbyFromModal = () => {
    const socket = getSocket();
    if (!socket) {
        return showToast('Error', 'Not connected to server', 'error');
    }
    
    if (!socket.connected) {
        return showToast('Error', 'Connecting to server... Please try again', 'error');
    }
    
    const nameInput = document.getElementById('newLobbyName');
    if (!nameInput) {
        return showToast('Error', 'Lobby name input not found', 'error');
    }
    
    const name = nameInput.value.trim();
    const gameType = window.currentGameType || 'connect_four';
    
    if (!name) {
        return showToast('Warning', 'Please enter a lobby name', 'info');
    }
    
    console.log('Creating lobby:', { name, gameType });
    socket.emit('lobby_create', { name, gameType });
    
    // Immediately switch to lobby screen
    const data = {
        lobbyId: null, // Will be updated when server responds
        isHost: true,
        name: name,
        gameType: gameType,
        players: [{
            username: currentUser.username,
            socketId: socket.id,
            id: currentUser.id
        }]
    };
    
    currentLobbyId = null;
    amIHost = true;
    
    document.getElementById('gameInfoModal').classList.add('hidden');
    showLobbyRoom(data);
    renderLobbyPlayers(data.players);
    showToast('Success', `Created lobby: ${name}`, 'success');
    
    // Clear the input field for next use
    nameInput.value = '';
};

window.leaveLobby = () => {
    const socket = getSocket();
    if (socket) {
        socket.emit('lobby_leave');
    }
    teardownLobby();
};

window.closeLobby = () => {
    const socket = getSocket();
    if (socket) {
        socket.emit('lobby_close');
    } else {
        console.warn('Socket not available when closing lobby');
    }
    teardownLobby();
};

window.kickPlayer = (socketId) => {
    const socket = getSocket();
    if (!socket) {
        showToast('Error', 'Not connected to server', 'error');
        return;
    }
    socket.emit('lobby_kick', socketId);
};

function teardownLobby() {
    currentLobbyId = null;
    amIHost = false;
    leaveLobbyRoom();
}

function renderLobbyList(lobbies) {
    const list = document.getElementById('infoLobbyList');
    if (!list) return;
    
    list.innerHTML = '';

    // Filter by current game type if selected
    const filterType = window.currentGameType || 'connect_four';
    const filteredLobbies = lobbies.filter(l => l.gameType === filterType || !l.gameType);

    if (filteredLobbies.length === 0) {
        list.innerHTML = '<p class="empty-message">No active lobbies. Create one!</p>';
        return;
    }

    filteredLobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.padding = '10px';
        item.style.borderBottom = '1px solid #334155';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        
        item.innerHTML = `
            <div class="lobby-info">
                <span class="lobby-name" style="font-weight:bold; color: #f1f5f9;">${lobby.name}</span>
                <span class="lobby-host" style="color: #94a3b8; font-size: 0.9rem; margin-left: 10px;">Host: ${lobby.host}</span>
                <span class="lobby-count" style="color: #6366f1; margin-left: 10px;">${lobby.players}/2</span>
            </div>
            <button class="join-btn" data-id="${lobby.id}" style="padding: 5px 10px; background: #6366f1; border: none; border-radius: 4px; color: white; cursor: pointer;">Join</button>
        `;
        list.appendChild(item);
    });
}

function renderLobbyPlayers(players) {
    const list = document.getElementById('lobbyPlayerList');
    const controls = document.getElementById('hostControls');
    
    if (!list) return;
    list.innerHTML = '';
    
    if (!players) return;

    players.forEach(p => {
        const row = document.createElement('div');
        row.className = 'player-row';
        
        let actions = '';
        // If I am host, and this is NOT me, show kick button
        if (amIHost && (!currentUser || p.username !== currentUser.username)) {
            actions = `<button class="control-btn kick-btn" onclick="kickPlayer('${p.socketId}')">Kick</button>`;
        }
        
        row.innerHTML = `
            <div class="player-info">
                <div class="player-avatar">${p.username.substring(0,2).toUpperCase()}</div>
                <span class="player-name">${p.username}</span> 
                ${p.socketId === currentLobbyId /* Hacky check for host? No we don't know host ID here easily */ ? '' : ''}
            </div>
            <div class="player-controls">
                ${actions}
            </div>
        `;
        list.appendChild(row);
    });
    
    // Toggle host controls visibility
    if (amIHost && controls) {
        controls.classList.remove('hidden');
        // Enable Start Game if 2 players
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            startBtn.disabled = players.length < 2;
        }
    } else if (controls) {
        controls.classList.add('hidden');
    }
}
