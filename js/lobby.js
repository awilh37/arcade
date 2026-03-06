import { getSocket } from './socket.js';
import { showToast, showLobbyRoom, leaveLobbyRoom, updateLobbyStatus } from './ui.js';
import { currentUser } from './auth.js';

let currentLobbyId = null;
let amIHost = false;

export function setupLobbyUI() {
    const socket = getSocket();
    if (!socket) return;
    
    // reset state
    currentLobbyId = null;
    amIHost = false;

    const infoLobbyList = document.getElementById('infoLobbyList');
    
    // Host Controls
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
             // socket.emit('game_start_req'); 
             showToast('Info', 'Game starts automatically when 2 players join!', 'info');
        });
    }

    // Create Lobby Handling (from Modal)
    window.createLobbyFromModal = () => {
        const nameInput = document.getElementById('newLobbyName');
        const name = nameInput.value.trim();
        const gameType = window.currentGameType || 'connect_four';
        
        socket.emit('lobby_create', { name, gameType });
    };

    // Handle Updates
    socket.on('lobby_update', (lobbies) => {
        renderLobbyList(lobbies); 
    });
    
    socket.on('lobby_joined', (data) => {
        showToast('Success', `Joined lobby: ${data.name}`, 'success');
        
        currentLobbyId = data.lobbyId;
        amIHost = data.isHost;
        
        // Hide Game Info Modal
        document.getElementById('gameInfoModal').classList.add('hidden');
        
        // Show Lobby Room
        showLobbyRoom(data);
        renderLobbyPlayers(data.players || []);
    });
    
    socket.on('lobby_player_update', (players) => {
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
        showToast('Error', msg, 'error');
    });

    // Join Handler
    if (infoLobbyList) {
        infoLobbyList.addEventListener('click', (e) => {
            if (e.target.classList.contains('join-btn')) {
                const lobbyId = e.target.dataset.id;
                socket.emit('lobby_join', lobbyId);
            }
        });
    }
    
    // Global Leave
    window.leaveLobby = () => {
        socket.emit('lobby_leave');
        teardownLobby();
    };
    
    window.closeLobby = () => {
        socket.emit('lobby_close');
        teardownLobby();
    };
    
    // Host Actions
    window.kickPlayer = (socketId) => {
        socket.emit('lobby_kick', socketId);
    };
}

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
    } else if (controls) {
        controls.classList.add('hidden');
    }
}
