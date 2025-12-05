require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
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

    const user = await dbGet('SELECT id, username, display_name, tokens, points FROM users WHERE username = ?', [username]);
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

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        tokens: user.tokens,
        points: user.points
      },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
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
      'SELECT id, username, display_name, tokens, points FROM users WHERE id = ?',
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
      'SELECT id, username, display_name, tokens, points FROM users WHERE id = ?',
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
app.post('/api/game/result', verifyToken, async (req, res) => {
  const { game_name, won, points_earned, time_taken } = req.body;

  if (!game_name || typeof won !== 'boolean') {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Insert game result
    await dbRun(
      'INSERT INTO game_results (user_id, game_name, won, points_earned, time_taken) VALUES (?, ?, ?, ?, ?)',
      [req.userId, game_name, won ? 1 : 0, points_earned || 0, time_taken || null]
    );

    // Update user points
    await dbRun(
      'UPDATE users SET points = points + ? WHERE id = ?',
      [points_earned || 0, req.userId]
    );

    // Get updated user
    const user = await dbGet(
      'SELECT id, username, display_name, tokens, points FROM users WHERE id = ?',
      [req.userId]
    );

    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
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
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDatabase();
});
