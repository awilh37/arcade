require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());

// ===== DATABASE INITIALIZATION =====
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        tokens INTEGER DEFAULT 1000,
        points INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Game results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_name VARCHAR(100) NOT NULL,
        won BOOLEAN NOT NULL,
        points_earned INTEGER DEFAULT 0,
        time_taken DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Leaderboard (aggregated points and wins)
    await client.query(`
      CREATE VIEW leaderboard AS
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.points,
        COUNT(CASE WHEN gr.won = true THEN 1 END) as wins,
        COUNT(gr.id) as total_games,
        RANK() OVER (ORDER BY u.points DESC) as rank
      FROM users u
      LEFT JOIN game_results gr ON u.id = gr.user_id
      GROUP BY u.id, u.username, u.display_name, u.points
      ORDER BY u.points DESC;
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
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
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, tokens, points',
      [username, email, passwordHash, display_name || username]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
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
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
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
    const result = await pool.query(
      'SELECT id, username, display_name, tokens, points FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
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
    const result = await pool.query(
      'UPDATE users SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, display_name, tokens, points',
      [display_name, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
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
    await pool.query(
      'INSERT INTO game_results (user_id, game_name, won, points_earned, time_taken) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, game_name, won, points_earned || 0, time_taken || null]
    );

    // Update user points
    await pool.query(
      'UPDATE users SET points = points + $1 WHERE id = $2',
      [points_earned || 0, req.userId]
    );

    // Get updated user
    const userResult = await pool.query(
      'SELECT id, username, display_name, tokens, points FROM users WHERE id = $1',
      [req.userId]
    );

    res.json({ success: true, user: userResult.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user game history
app.get('/api/game/history', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, game_name, won, points_earned, time_taken, created_at FROM game_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== LEADERBOARD ENDPOINTS =====

// Get leaderboard (top 100)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, points, wins, total_games, rank FROM leaderboard LIMIT 100'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user rank
app.get('/api/leaderboard/rank', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rank, points, wins, total_games FROM leaderboard WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found on leaderboard' });
    }
    res.json(result.rows[0]);
  } catch (error) {
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
    const userResult = await pool.query('SELECT points, tokens FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];

    if (user.points < cost) {
      return res.status(400).json({ error: 'Not enough points' });
    }

    const result = await pool.query(
      'UPDATE users SET points = points - $1, tokens = tokens + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING tokens, points',
      [cost, amount, req.userId]
    );

    res.json({ success: true, tokens: result.rows[0].tokens, points: result.rows[0].points });
  } catch (error) {
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
