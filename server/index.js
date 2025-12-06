require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database selection: use Postgres when DATABASE_URL is set (Render), otherwise fall back to local SQLite for dev
const USE_PG = !!process.env.DATABASE_URL;
let pgClient = null;
let sqlite3;
let sqliteDb = null;
const dbPath = path.join(__dirname, 'arcade.db');

function convertPlaceholders(sql) {
  // Convert '?' placeholders to $1, $2 ... for pg
  let i = 0;
  return sql.replace(/\?/g, () => {
    i += 1;
    return '$' + i;
  });
}

// Unified DB helpers (work with Postgres if connected, otherwise SQLite)
const dbRun = async (sql, params = []) => {
  if (pgClient) {
    const q = convertPlaceholders(sql);
    return pgClient.query(q, params);
  }

  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = async (sql, params = []) => {
  if (pgClient) {
    const q = convertPlaceholders(sql);
    const res = await pgClient.query(q, params);
    return res.rows[0];
  }

  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = async (sql, params = []) => {
  if (pgClient) {
    const q = convertPlaceholders(sql);
    const res = await pgClient.query(q, params);
    return res.rows;
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
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
    if (process.env.DATABASE_URL) {
      try {
        // Try connecting to Postgres
        pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
        await pgClient.connect();
        console.log('Connected to Postgres via DATABASE_URL');

        // Create tables with Postgres-compatible SQL
        await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          tokens INTEGER DEFAULT 1000,
          points INTEGER DEFAULT 0,
          role TEXT DEFAULT 'player' CHECK (role IN ('player','muted','admin','banned','owner')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS game_results (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          game_name TEXT NOT NULL,
          won INTEGER NOT NULL,
          points_earned INTEGER DEFAULT 0,
          time_taken REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      } catch (pgErr) {
        console.warn('Postgres connection failed, falling back to SQLite:', pgErr?.message || pgErr);
        pgClient = null;
      }
    }

    if (!pgClient) {
      // Initialize local SQLite for development
      sqlite3 = require('sqlite3').verbose();
      sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Database open error:', err);
        else console.log('Connected to SQLite database at', dbPath);
      });

      // SQLite table creation
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
    }

    // Ensure the owner user is set if the username exists
    await dbRun(
      "UPDATE users SET role = 'owner' WHERE username = 'awilh' AND role != 'owner'",
      []
    );

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

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        tokens: user.tokens,
        points: user.points,
        role: user.role
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
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDatabase();
});
