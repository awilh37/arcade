const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Game State
// Format: { lobbyId: { id, name, hostId, players: [], status: 'waiting'|'playing', game: null } }
const lobbies = {};
// Format: { socketId: lobbyId }
const playerLobbyMap = {};

// Helper: Check for winner
function checkWin(board, player) {
  // Board: 6 rows, 7 cols. 0=empty, 1=p1, 2=p2
  // Horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        board[r][c] === player &&
        board[r][c + 1] === player &&
        board[r][c + 2] === player &&
        board[r][c + 3] === player
      ) {
        return true;
      }
    }
  }
  // Vertical
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c] === player &&
        board[r + 2][c] === player &&
        board[r + 3][c] === player
      ) {
        return true;
      }
    }
  }
  // Diagonal /
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        board[r][c] === player &&
        board[r - 1][c + 1] === player &&
        board[r - 2][c + 2] === player &&
        board[r - 3][c + 3] === player
      ) {
        return true;
      }
    }
  }
  // Diagonal \
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c + 1] === player &&
        board[r + 2][c + 2] === player &&
        board[r + 3][c + 3] === player
      ) {
        return true;
      }
    }
  }
  return false;
}

class ConnectFourGame {
  constructor(p1, p2) {
    this.players = [p1, p2]; // [ {id, username, socketId}, ... ]
    this.board = Array(6)
      .fill(null)
      .map(() => Array(7).fill(0));
    this.turn = 0; // 0 or 1 (index of player)
    this.winner = null;
    this.moves = 0;
  }

  makeMove(playerIndex, col) {
    if (this.winner !== null)
      return { valid: false, message: "Game over" };
    if (playerIndex !== this.turn)
      return { valid: false, message: "Not your turn" };
    if (col < 0 || col >= 7)
      return { valid: false, message: "Invalid column" };

    // Find first empty row in column (from bottom up)
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (this.board[r][col] === 0) {
        row = r;
        break;
      }
    }

    if (row === -1) return { valid: false, message: "Column full" };

    // Valid move
    this.board[row][col] = playerIndex + 1;
    this.moves++;

    // Check win
    if (checkWin(this.board, playerIndex + 1)) {
      this.winner = playerIndex;
      return { valid: true, win: true, row, col };
    }

    // Check draw
    if (this.moves === 42) {
      this.winner = -1; // Draw
      return { valid: true, draw: true, row, col };
    }

    // Switch turn
    this.turn = 1 - this.turn;
    return { valid: true, row, col };
  }
}

function setupSocket(server, db) {
  const io = new Server(server, {
    cors: {
      origin: "*", // Adjust in production
      methods: ["GET", "POST"],
    },
  });

  // Middleware for Auth
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key-change-in-production"
      );
      socket.user = decoded; // { userId, username }
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Helper to broadcast lobby list
    const broadcastLobbyList = () => {
      const list = Object.values(lobbies)
        .filter((l) => l.status === "waiting")
        .map((l) => ({
          id: l.id,
          name: l.name,
          host: l.hostName,
          gameType: l.gameType,
          players: l.players.length,
        }));
      io.emit("lobby_update", list);
    };

    // Initial List
    socket.emit("lobby_update", 
      Object.values(lobbies)
        .filter((l) => l.status === "waiting")
        .map((l) => ({ id: l.id, name: l.name, host: l.hostName, gameType: l.gameType, players: l.players.length }))
    );

    // Create Lobby
    socket.on("lobby_create", (data) => {
      // Data can be just name (string) or object { name, gameType }
      const lobbyName = (typeof data === 'object') ? data.name : data;
      const gameType = (typeof data === 'object' && data.gameType) ? data.gameType : 'connect_four';

      // Check if already in a lobby? Ideally yes.
      if (playerLobbyMap[socket.id]) return;

      const lobbyId = "lobby_" + Date.now();
      lobbies[lobbyId] = {
        id: lobbyId,
        name: lobbyName || `${socket.user.username}'s Game`,
        gameType: gameType,
        hostId: socket.id,
        hostName: socket.user.username,
        players: [
          {
            id: socket.user.userId,
            username: socket.user.username,
            socketId: socket.id,
          },
        ],
        status: "waiting",
        game: null,
      };
      playerLobbyMap[socket.id] = lobbyId;

      socket.join(lobbyId);
      socket.emit("lobby_joined", {
        lobbyId,
        isHost: true,
        name: lobbies[lobbyId].name,
        gameType: lobbies[lobbyId].gameType,
        players: lobbies[lobbyId].players
      });
      broadcastLobbyList();
    });

    // Join Lobby
    socket.on("lobby_join", (lobbyId) => {
      const lobby = lobbies[lobbyId];
      if (!lobby) return socket.emit("error", "Lobby not found");
      if (lobby.status !== "waiting") return socket.emit("error", "Game already in progress");
      if (lobby.players.length >= 2) return socket.emit("error", "Lobby full");
      if (playerLobbyMap[socket.id]) return socket.emit("error", "Already in a game");

      // Add player
      lobby.players.push({
        id: socket.user.userId,
        username: socket.user.username,
        socketId: socket.id,
      });
      playerLobbyMap[socket.id] = lobbyId;
      socket.join(lobbyId);

      // DO NOT Start Game immediately when 2 players exist. Wait for host.
      // We still want to remove from the waiting list if full so no one else joins,
      // but status remains "waiting" internally for host to start, or we change it to "full".
      if (lobby.players.length === 2) {
          lobby.status = "full";
          broadcastLobbyList(); 
      }
      
      // Notify everyone in lobby about new player
      io.to(lobbyId).emit("lobby_player_update", lobby.players);
      
      // Notify everyone in lobby about new player
      io.to(lobbyId).emit("lobby_player_update", lobby.players);
    });

    // Host Controls
    socket.on("lobby_kick", (targetSocketId) => {
        const lobbyId = playerLobbyMap[socket.id];
        if (!lobbyId) return;
        const lobby = lobbies[lobbyId];
        if (!lobby || lobby.hostId !== socket.id) return socket.emit("error", "Not authorized");

        const targetPlayer = lobby.players.find(p => p.socketId === targetSocketId);
        if (!targetPlayer) return;

        // Remove player
        lobby.players = lobby.players.filter(p => p.socketId !== targetSocketId);
        delete playerLobbyMap[targetSocketId];
        
        // Notify kicked player
        io.to(targetSocketId).emit("error", "You were kicked from the lobby.");
        io.to(targetSocketId).emit("lobby_kicked"); // Client handle leave
        io.sockets.sockets.get(targetSocketId)?.leave(lobbyId);

        io.to(lobbyId).emit("lobby_player_update", lobby.players);
        broadcastLobbyList();
    });
    
    socket.on("lobby_close", () => {
        const lobbyId = playerLobbyMap[socket.id];
        if (!lobbyId) return;
        const lobby = lobbies[lobbyId];
        if (!lobby || lobby.hostId !== socket.id) return socket.emit("error", "Not authorized");
        
        // Notify all
        io.to(lobbyId).emit("lobby_closed", "Host closed the lobby.");
        
        // Cleanup
        lobby.players.forEach(p => {
            delete playerLobbyMap[p.socketId];
            io.sockets.sockets.get(p.socketId)?.leave(lobbyId);
        });
        delete lobbies[lobbyId];
        broadcastLobbyList();
    });
    
    // Leave Lobby / Cancel
    socket.on("lobby_leave", () => {
        handleDisconnect(socket);
    });

    // Start Game (Host only)
    socket.on("game_start_req", () => {
        const lobbyId = playerLobbyMap[socket.id];
        if (!lobbyId) return;
        const lobby = lobbies[lobbyId];
        
        // Only host can start
        if (!lobby || lobby.hostId !== socket.id) return socket.emit("error", "Not authorized");
        
        // Need 2 players
        if (lobby.players.length !== 2) return socket.emit("error", "Need 2 players to start");

        lobby.status = "playing";
        if (lobby.gameType === 'connect_four') {
            lobby.game = new ConnectFourGame(lobby.players[0], lobby.players[1]);
        }
        
        io.to(lobbyId).emit("game_start", {
            players: lobby.players.map((p) => p.username),
            turn: 0, 
            board: lobby.game ? lobby.game.board : []
        });
        broadcastLobbyList();
    });

    // Game Move
    socket.on("game_move", ({ col }) => {
      console.log(`[Server] Received move from ${socket.id} col: ${col}`);
      
      const lobbyId = playerLobbyMap[socket.id];
      if (!lobbyId) {
          console.log(`[Server] No lobby found for socket ${socket.id}`);
          socket.emit('error', 'Server: You are not in a lobby.');
          return;
      }

      const lobby = lobbies[lobbyId];
      if (!lobby) {
           console.log(`[Server] Lobby ${lobbyId} not found in lobbies list.`);
           socket.emit('error', 'Server: Lobby not found.');
           return;
      }

      if (!lobby.game) {
           console.log(`[Server] No game instance in lobby ${lobbyId}.`);
           socket.emit('error', 'Server: Game instance missing.');
           return;
      }
      
      if (lobby.status !== "playing") {
           console.log(`[Server] Lobby status is ${lobby.status}, not playing.`);
           socket.emit('error', `Server: Game not acting (Status: ${lobby.status})`);
           return;
      }

      const playerIndex = lobby.players.findIndex(
        (p) => p.socketId === socket.id
      );
      
      if (playerIndex === -1) {
          console.log(`[Server] Socket ${socket.id} not found in player list:`, lobby.players);
          socket.emit('error', 'Server: Player not found in this lobby.');
          return;
      }

      console.log(`[Server] Processing move for Player ${playerIndex}`);

      const result = lobby.game.makeMove(playerIndex, col);
      console.log(`[Server] Move result:`, result);
      
      if (result.valid) {
        // Broadcast move to room
        io.to(lobbyId).emit("game_update", {
          row: result.row,
          col: result.col,
          player: playerIndex,
          nextTurn: lobby.game.turn,
        });

        if (result.win) {
          
          // Update Points in DB
          if (db) {
              const winnerId = lobby.players[playerIndex].id;
              const pointsWon = 50; // Points for winning
              
              db.run('UPDATE users SET points = points + ? WHERE id = ?', [pointsWon, winnerId], (err) => {
                  if (err) console.error("Failed to update points:", err);
                  else console.log(`Awarded ${pointsWon} points to user ${winnerId}`);
              });
              
              io.to(lobbyId).emit("game_over", {
                winner: playerIndex,
                winnerName: lobby.players[playerIndex].username,
                reason: "win",
                pointsEarned: pointsWon
              });
          } else {
              // Fallback if DB not available
              io.to(lobbyId).emit("game_over", {
                winner: playerIndex,
                winnerName: lobby.players[playerIndex].username,
                reason: "win",
                pointsEarned: 0
              });
          }
          
          cleanupLobby(lobbyId);
        } else if (result.draw) {
          io.to(lobbyId).emit("game_over", { winner: -1, reason: "draw" });
          cleanupLobby(lobbyId);
        }
      } else {
        console.log(`[Server] Invalid move: ${result.message}`);
        socket.emit("error", result.message);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      handleDisconnect(socket);
    });

    function handleDisconnect(sock) {
        const lobbyId = playerLobbyMap[sock.id];
        if (lobbyId) {
            const lobby = lobbies[lobbyId];
            if (lobby) {
                // If waiting, just remove. If playing, forfeit.
                if (lobby.status === 'playing') {
                   // Other player wins
                   const otherPlayer = lobby.players.find(p => p.socketId !== sock.id);
                   if (otherPlayer) {
                       io.to(otherPlayer.socketId).emit("game_over", {
                           winner: -2, // Disconnect win logic
                           winnerName: otherPlayer.username,
                           reason: "opponent_disconnected"
                       });
                   }
                }
                
                // Remove socket from map
                lobby.players.forEach(p => delete playerLobbyMap[p.socketId]);
                delete lobbies[lobbyId];
                broadcastLobbyList();
            }
        }
    }
    
    function cleanupLobby(lobbyId) {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;
        // Keep them in room for chat/rematch? Or kick them out?
        // For simplicity: End game state, but maybe keep lobby open?
        // Let's just reset for now or kick to lobby list.
        // Implementation: Just remove lobby data logic but keep sockets connected? 
        // Actually usually you want a "Play Again" button.
        // For MVP: Kick to lobby after 5 seconds?
        
        // We actually deleted it in the logic above properly.
        // Wait, if we delete it, `playerLobbyMap` is cleared.
        // Users are still in the socket room but the server state is gone.
    }
  });
}

module.exports = setupSocket;
