# Arcade Backend Server Setup Guide

## Overview
This is a Node.js/Express backend for the Digital Arcade game. It handles:
- User authentication (register/login with JWT)
- User profiles (display name, tokens, points)
- Game result tracking
- Leaderboard rankings
- Shop (buy tokens with points)

## Prerequisites
- Node.js 18.x or higher
- PostgreSQL database
- Render account (for deployment)

## Local Setup

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Create a local PostgreSQL database:**
   ```bash
   createdb arcade_db
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   ```
   DATABASE_URL=postgresql://localhost:5432/arcade_db
   JWT_SECRET=your-local-secret-key
   PORT=5000
   ```

4. **Start the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

The server will initialize the database tables automatically on first run.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### User
- `GET /api/user` - Get current user data (requires token)
- `PUT /api/user/display-name` - Update display name (requires token)

### Games
- `POST /api/game/result` - Record game result (requires token)
- `GET /api/game/history` - Get user's game history (requires token)

### Leaderboard
- `GET /api/leaderboard` - Get top 100 players
- `GET /api/leaderboard/rank` - Get user's rank (requires token)

### Shop
- `POST /api/shop/buy-tokens` - Buy tokens with points (requires token)

### Health
- `GET /api/health` - Check server status

## Deployment to Render

### Step 1: Prepare Repository
Push your code to GitHub (if not already done):
```bash
git add .
git commit -m "Add backend server"
git push origin main
```

### Step 2: Create Render PostgreSQL Database

1. Go to [Render.com](https://render.com) and sign in
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in details:
   - **Name:** `arcade-db`
   - **Database:** `arcade_db`
   - **User:** `arcade_user`
   - **Region:** Choose closest to you
4. Click **"Create Database"**
5. Once created, copy the connection string (looks like `postgresql://...`)

### Step 3: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. **Connect your GitHub repository:**
   - Search for your `arcade` repo
   - Select it and click **"Connect"**
3. **Fill in configuration:**
   - **Name:** `arcade-backend`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Choose Free (or Starter if free is unavailable)

4. **Add Environment Variables:**
   Click **"Advanced"** and add:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Paste the PostgreSQL connection string from Step 2
   - `JWT_SECRET`: Generate a strong random string (e.g., `openssl rand -base64 32`)
   - `PORT`: `5000` (Render assigns this automatically, optional)

5. Click **"Create Web Service"**

### Step 4: Wait for Deployment

Render will automatically:
- Clone your repo
- Install dependencies
- Start the server
- Initialize database tables

Once deployed, you'll see a URL like `https://arcade-backend-xxxx.onrender.com`

### Step 5: Update Frontend

Update your frontend's API base URL in `script.js`:
```javascript
const API_BASE_URL = 'https://arcade-backend-xxxx.onrender.com';
```

## Testing

Test the server locally:
```bash
curl http://localhost:5000/api/health
```

Test registration:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

## Database Schema

### Users Table
- `id` (PRIMARY KEY)
- `username` (UNIQUE)
- `email` (UNIQUE)
- `password_hash`
- `display_name`
- `tokens` (default: 1000)
- `points` (default: 0)
- `created_at`, `updated_at`

### Game Results Table
- `id` (PRIMARY KEY)
- `user_id` (FOREIGN KEY → users)
- `game_name`
- `won` (BOOLEAN)
- `points_earned`
- `time_taken` (nullable)
- `created_at`

### Leaderboard View
Aggregated view showing:
- User rank
- Total points
- Win count
- Total games played

## Future Enhancements

- Add email verification
- Implement refresh token rotation
- Add more shop items
- Add seasonal leaderboards
- Implement anti-cheat measures
- Add game statistics and analytics
