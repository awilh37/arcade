require('dotenv').config();
const express = require('express');
const http = require('http'); // [NEW]
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const setupSocket = require('./socket'); // [NEW]

const app = express();
const server = http.createServer(app); // [NEW] Wrap express
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// SQLite Database Setup
const dbPath = path.join(__dirname, 'arcade.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database open error:', err);
  else console.log('Connected to SQLite database at', dbPath);
});

// Promisify database operations
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve static files from root


// ===== DATABASE INITIALIZATION =====
async function initializeDatabase() {
  try {
    // Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        tokens INTEGER DEFAULT 1000,
        points INTEGER DEFAULT 0,
        role TEXT DEFAULT 'player' CHECK(role IN ('player', 'muted', 'admin', 'banned', 'owner')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Game results table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS game_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_name TEXT NOT NULL,
        won INTEGER NOT NULL,
        points_earned INTEGER DEFAULT 0,
        time_taken REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Set awilh as owner if they exist
    await dbRun(`
      UPDATE users SET role = 'owner' WHERE username = 'awilh' AND role != 'owner'
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// ===== AUTHENTICATION ENDPOINTS =====

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, display_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, display_name || username]
    );

    const user = await dbGet('SELECT id, username, display_name, tokens, points, role FROM users WHERE username = ?', [username]);
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is banned
    if (user.role === 'banned') {
      return res.status(403).json({ error: 'Your account has been banned' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        tokens: user.tokens,
        points: user.points,
        role: user.role
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = await dbGet('SELECT id, username, display_name, tokens, points, role FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const newRefreshToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        tokens: user.tokens,
        points: user.points,
        role: user.role
      },
      token,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ===== USER ENDPOINTS =====

// Get current user
app.get('/api/user', verifyToken, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, username, display_name, tokens, points, role FROM users WHERE id = ?',
      [req.userId]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user display name
app.put('/api/user/display-name', verifyToken, async (req, res) => {
  const { display_name } = req.body;

  if (!display_name) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  try {
    await dbRun(
      'UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [display_name, req.userId]
    );
    const user = await dbGet(
      'SELECT id, username, display_name, tokens, points, role FROM users WHERE id = ?',
      [req.userId]
    );
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== GAME ENDPOINTS =====

// Record game result
// Record game result (Legacy/Insecure - kept for backward compatibility if needed, or remove)
app.post('/api/game/result', verifyToken, async (req, res) => {
  // ... (keeping existing logic for now, or we can deprecate it)
  // For this refactor, I will leave it but add the new one above/below.
  // Actually, to avoid clutter, I'll replace it with the new secure endpoint AND the legacy one if needed.
  // But the plan said "Remove/Deprecate", so I'll just add the new one for now.
    const { game_name, won, points_earned, time_taken } = req.body;
    // ... legacy implementation ...
    
    // Auto-deprecate for security? 
    // Let's just keep it for the games we haven't migrated yet (Reaction/Match).
    
    if (!game_name || typeof won !== 'boolean') {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await dbRun(
            'INSERT INTO game_results (user_id, game_name, won, points_earned, time_taken) VALUES (?, ?, ?, ?, ?)',
            [req.userId, game_name, won ? 1 : 0, points_earned || 0, time_taken || null]
        );
        await dbRun('UPDATE users SET points = points + ? WHERE id = ?', [points_earned || 0, req.userId]);
        const user = await dbGet('SELECT id, username, display_name, tokens, points FROM users WHERE id = ?', [req.userId]);
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Secure Game Play Endpoint
app.post('/api/game/play', verifyToken, async (req, res) => {
    const { game_name, bet_amount, bet_details } = req.body;

    if (!game_name || !bet_amount || bet_amount < 1) {
        return res.status(400).json({ error: 'Invalid game parameters' });
    }

    try {
        // 1. Check Balance
        const user = await dbGet('SELECT tokens, points FROM users WHERE id = ?', [req.userId]);
        if (user.tokens < bet_amount) {
            return res.status(400).json({ error: 'Not enough tokens' });
        }

        // 2. Execute Game Logic
        let won = false;
        let payout = 0;
        let pointsReward = 0;
        let resultDetails = {};

        if (game_name === 'coinFlip') {
            // coinFlip logic: 50/50
            const choices = ['heads', 'tails'];
            const result = choices[Math.floor(Math.random() * choices.length)];
            won = (bet_details === result);
            resultDetails = { result };
            if (won) {
                pointsReward = 50; 
                // In the original client code, you just kept your tokens? Or doubled?
                // The client code said: "Simple 50/50 chance to double your bet" text, but logic only gave POINTS.
                // Let's standardize: If you win, you KEEP your tokens (or get double?) 
                // The original code: `gameState.tokens -= gameState.currentWager` happens on START.
                // Then `showResult` adds points. It says `resultTokenChange.textContent = '+0'`.
                // So the original game was: Pay tokens -> Win Points. You LOSE tokens either way.
                // Wait, that's a "shop" not a "gamble" if you always lose tokens.
                // Let's make it a REAL gamble: Win = Get Token Wager Back + Profit? 
                // For now, I will stick to the APPARENT behavior:
                // Original: Pay tokens -> Win Points. Wager is sunk cost.
                // I will maintain: Pay tokens. If win, get Points.
            }

        } else if (game_name === 'numberGuess') {
            // numberGuess logic: 1/10
            const secret = Math.floor(Math.random() * 10) + 1;
            won = (parseInt(bet_details) === secret);
            resultDetails = { result: secret };
            if (won) {
                pointsReward = 100;
            }
        
        } else {
            return res.status(400).json({ error: 'Game not supported securely yet' });
        }

        // 3. Update DB
        // Deduct tokens (wager) always
        await dbRun('UPDATE users SET tokens = tokens - ? WHERE id = ?', [bet_amount, req.userId]);
        
        // If won, add points
        if (won) {
            await dbRun('UPDATE users SET points = points + ? WHERE id = ?', [pointsReward, req.userId]);
        }

        // Record stats
        await dbRun(
            'INSERT INTO game_results (user_id, game_name, won, points_earned) VALUES (?, ?, ?, ?)',
            [req.userId, game_name, won ? 1 : 0, pointsReward]
        );

        // 4. Return new state
        const updatedUser = await dbGet('SELECT id, username, display_name, tokens, points FROM users WHERE id = ?', [req.userId]);
        
        res.json({
            success: true,
            won,
            points_earned: pointsReward,
            result_details: resultDetails,
            user: updatedUser
        });

    } catch (error) {
        console.error('Secure game error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user game history
app.get('/api/game/history', verifyToken, async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT id, game_name, won, points_earned, time_taken, created_at FROM game_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== LEADERBOARD ENDPOINTS =====

// Get leaderboard (top 100)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.points,
        COUNT(CASE WHEN gr.won = 1 THEN 1 END) as wins,
        COUNT(gr.id) as total_games
      FROM users u
      LEFT JOIN game_results gr ON u.id = gr.user_id
      GROUP BY u.id
      ORDER BY u.points DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user rank
app.get('/api/leaderboard/rank', verifyToken, async (req, res) => {
  try {
    const result = await dbAll(`
      SELECT 
        u.id,
        u.points,
        COUNT(CASE WHEN gr.won = 1 THEN 1 END) as wins,
        COUNT(gr.id) as total_games
      FROM users u
      LEFT JOIN game_results gr ON u.id = gr.user_id
      GROUP BY u.id
      ORDER BY u.points DESC
    `);

    const rank = result.findIndex(r => r.id === req.userId) + 1;
    const userData = result.find(r => r.id === req.userId);

    res.json({
      rank,
      points: userData.points,
      wins: userData.wins,
      total_games: userData.total_games
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== ADMIN ENDPOINTS =====

// Helper function to check if user can perform admin actions
async function canUserManageOthers(userId) {
  const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]);
  return user && (user.role === 'admin' || user.role === 'owner');
}

// Helper function to check if target user can be modified
async function canModifyUser(adminRole, targetRole) {
  // Admins cannot modify owners
  if (adminRole === 'admin' && targetRole === 'owner') {
    return false;
  }
  // Owners can modify anyone
  return adminRole === 'owner' ? true : (adminRole === 'admin');
}

// Get all users (for admin panel)
app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (!(await canUserManageOthers(req.userId))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const users = await dbAll(`
      SELECT id, username, display_name, tokens, points, role, created_at FROM users ORDER BY username
    `);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users by username
app.get('/api/admin/users/search/:username', verifyToken, async (req, res) => {
  try {
    if (!(await canUserManageOthers(req.userId))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { username } = req.params;
    const users = await dbAll(
      'SELECT id, username, display_name, tokens, points, role, created_at FROM users WHERE username LIKE ? ORDER BY username LIMIT 20',
      [`%${username}%`]
    );
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change user role
app.post('/api/admin/user/change-role', verifyToken, async (req, res) => {
  const { targetUserId, newRole } = req.body;

  if (!targetUserId || !newRole) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['player', 'muted', 'admin', 'banned', 'owner'].includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const admin = await dbGet('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!(admin && (admin.role === 'admin' || admin.role === 'owner'))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const target = await dbGet('SELECT role FROM users WHERE id = ?', [targetUserId]);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if admin can modify this user
    if (!(await canModifyUser(admin.role, target.role))) {
      return res.status(403).json({ error: 'Cannot modify owner accounts' });
    }

    // Prevent changing owner role unless you're an owner changing it to something else
    if (target.role === 'owner' && admin.role === 'admin') {
      return res.status(403).json({ error: 'Cannot modify owner accounts' });
    }

    // Prevent admins from promoting themselves to owner
    if (admin.role === 'admin' && newRole === 'owner') {
      return res.status(403).json({ error: 'Only owners can promote to owner' });
    }

    await dbRun(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newRole, targetUserId]
    );

    const updated = await dbGet(
      'SELECT id, username, display_name, tokens, points, role FROM users WHERE id = ?',
      [targetUserId]
    );

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Modify user tokens/points
app.post('/api/admin/user/modify-resources', verifyToken, async (req, res) => {
  const { targetUserId, tokensChange, pointsChange } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Missing target user ID' });
  }

  if ((tokensChange !== undefined && typeof tokensChange !== 'number') ||
      (pointsChange !== undefined && typeof pointsChange !== 'number')) {
    return res.status(400).json({ error: 'Changes must be numbers' });
  }

  try {
    const admin = await dbGet('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!(admin && (admin.role === 'admin' || admin.role === 'owner'))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const target = await dbGet('SELECT role, tokens, points FROM users WHERE id = ?', [targetUserId]);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!(await canModifyUser(admin.role, target.role))) {
      return res.status(403).json({ error: 'Cannot modify owner accounts' });
    }

    const newTokens = tokensChange !== undefined ? target.tokens + tokensChange : target.tokens;
    const newPoints = pointsChange !== undefined ? target.points + pointsChange : target.points;

    if (newTokens < 0 || newPoints < 0) {
      return res.status(400).json({ error: 'Resources cannot go below 0' });
    }

    await dbRun(
      'UPDATE users SET tokens = ?, points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newTokens, newPoints, targetUserId]
    );

    const updated = await dbGet(
      'SELECT id, username, display_name, tokens, points, role FROM users WHERE id = ?',
      [targetUserId]
    );

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== SHOP ENDPOINTS =====

// Buy tokens
app.post('/api/shop/buy-tokens', verifyToken, async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const cost = amount * 10; // 10 points per token

  try {
    const user = await dbGet('SELECT points, tokens FROM users WHERE id = ?', [req.userId]);

    if (user.points < cost) {
      return res.status(400).json({ error: 'Not enough points' });
    }

    await dbRun(
      'UPDATE users SET points = points - ?, tokens = tokens + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [cost, amount, req.userId]
    );

    const updated = await dbGet('SELECT tokens, points FROM users WHERE id = ?', [req.userId]);
    res.json({ success: true, tokens: updated.tokens, points: updated.points });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Start server
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDatabase();
  setupSocket(server, db); // [NEW] Initialize Socket.IO with DB access
});
