import { getSocket } from './socket.js';
import { showToast, showResultModal } from './ui.js';
import { currentUser } from './auth.js';

let myPlayerIndex = -1; // Are we P1 (0) or P2 (1)?
let isMyTurn = false;

export function setupConnectFour() {
    const socket = getSocket();
    if (!socket) return;

    // Create Grid
    const grid = document.getElementById('c4Grid');
    grid.innerHTML = '';
    // 6 rows, 7 cols
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = document.createElement('div');
            cell.className = 'c4-cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            // Click any cell in column to drop
            cell.addEventListener('click', () => handleColumnClick(c));
            grid.appendChild(cell);
        }
    }

    // Socket Events
    socket.on('game_start', (data) => {
        console.log('Game Started:', data);
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('gameScreen').classList.add('active');
        
        // Who am I?
        const myUsername = currentUser ? currentUser.username : ''; 
        myPlayerIndex = data.players.findIndex(name => name === myUsername);
        
        console.log('Game Start:', { players: data.players, me: myUsername, index: myPlayerIndex });
        
        if (myPlayerIndex === -1) {
            console.error("Could not find my username in player list!");
            showToast('Error', 'Could not identify player. Check console.', 'error');
        }
        
        updateGameStatus(data.turn);
        renderBoard(data.board);
    });

    socket.on('game_update', (data) => {
        // data: { row, col, player, nextTurn }
        animateDrop(data.row, data.col, data.player);
        updateGameStatus(data.nextTurn);
    });

    socket.on('game_over', (data) => {
        let msg = '';
        let won = false;
        
        if (data.winner === -1) {
            msg = "It's a Draw!";
        } else if (data.winner === myPlayerIndex) {
            msg = "You Won!";
            won = true;
        } else {
            msg = `${data.winnerName} Won!`;
        }
        
        const points = data.pointsEarned || 0;
        showResultModal(won, points);
        
        // Refresh to update header points/tokens after a delay
        setTimeout(() => {
            document.getElementById('resultModal').classList.add('hidden');
            window.location.reload(); 
        }, 5000);
    });
}

function handleColumnClick(col) {
    console.log('Column clicked:', col, 'MyTurn:', isMyTurn, 'Index:', myPlayerIndex);
    
    if (myPlayerIndex === -1) {
        showToast('Error', 'You are not recognized as a player.', 'error');
        return;
    }

    if (!isMyTurn) {
        showToast('Wait', 'It is not your turn!', 'warning');
        return;
    }
    const socket = getSocket();
    if (socket) {
        socket.emit('game_move', { col });
    } else {
        console.error("Socket not found in handleColumnClick");
    }
}

function updateGameStatus(turnIndex) {
    const statusEl = document.getElementById('gameStatus');
    isMyTurn = (turnIndex === myPlayerIndex);
    
    if (isMyTurn) {
        statusEl.textContent = "Your Turn";
        statusEl.className = "status-your-turn";
    } else {
        statusEl.textContent = "Opponent's Turn";
        statusEl.className = "status-opponent-turn";
    }
}

function renderBoard(board) {
    // board[r][c] = 0, 1, 2
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
            updateCell(r, c, board[r][c]);
        }
    }
}

function updateCell(r, c, val) {
    const cell = document.querySelector(`.c4-cell[data-r="${r}"][data-c="${c}"]`);
    cell.className = 'c4-cell'; // Reset
    if (val === 1) cell.classList.add('p1');
    if (val === 2) cell.classList.add('p2');
}

function animateDrop(r, c, playerIndex) {
    // For now just instant update, animation logic can be added later
    updateCell(r, c, playerIndex + 1);
}
