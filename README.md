# arcade

A competitive digital arcade game platform with token economy, leaderboards, and a shop system.

**Version**: 0.10

## Features

- **4 Playable Games**: Coin Flip, Number Guess, Reaction Time, and Match Cards
- **Token & Points System**: Earn points from games and buy tokens using points
- **User Accounts**: Register, login, and manage your profile
- **Live Leaderboard**: Dynamic global leaderboard sorted by points with medals for top 3
- **In-Game Leaderboard**: View leaderboards while playing
- **Chat Feature**: In-memory community chat (messages not persisted to backend)
- **Themes**: Customizable color themes (Default, Ocean, Sunset, Forest, Midnight)
- **Shop System**: Buy tokens using your points

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express, SQLite3 (local), bcryptjs, JWT
- **Deployment**: Render (PostgreSQL + Web Service)

## Local Development

### Prerequisites
- Node.js 18.x or higher
- A terminal/shell

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/awilh37/arcade.git
   cd arcade
   ```

2. **Start the backend server**:
   ```bash
   cd server
   npm install
   npm start
   ```
   The server will start on `http://localhost:5000` and initialize the SQLite database.

3. **Start the frontend** (in a new terminal):
   ```bash
   # From the root directory, serve the static files
   python3 -m http.server 8000
   ```
   Open `http://localhost:8000` in your browser.

4. **Test the app**:
   - Create a new account or login
   - Play games to earn points
   - Buy tokens in the shop using your points
   - Check your rank on the leaderboard
   - Customize your theme in the account menu

## Deployment to Render

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Add backend and frontend"
git push origin main
```

### Step 2: Create PostgreSQL Database on Render

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `arcade-db`
   - **Database**: `arcade_db`
   - **User**: `arcade_user`
   - **Region**: Choose your nearest region
4. Click **"Create Database"**
5. Copy the connection string (save it for Step 3)

### Step 3: Create Web Service on Render

1. Click **"New +"** → **"Web Service"**
2. **Connect your GitHub repo**:
   - Search for and select your `arcade` repository
   - Click **"Connect"**
3. **Configure the service**:
   - **Name**: `arcade-backend`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Choose Free or Starter

4. **Add Environment Variables** (click **"Advanced"**):
   ```
   DATABASE_URL=<postgresql://... connection string from Step 2>
   JWT_SECRET=<generate a random 32-character string>
   NODE_ENV=production
   PORT=5000
   ```

5. Click **"Create Web Service"** and wait for deployment (~2-3 minutes)

### Step 4: Update Frontend for Production

Once your backend is deployed, update the API URL in `script.js`:

```javascript
// Change this line:
const API_BASE_URL = 'http://localhost:5000';

// To your Render URL:
const API_BASE_URL = 'https://arcade-backend-xxx.onrender.com';
```

Then redeploy your frontend (host the static files on Render, Netlify, Vercel, or your own server).

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### User
- `GET /api/user` - Get current user (requires token)
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

## Database Schema

### Users
- `id` (INTEGER PRIMARY KEY)
- `username` (TEXT UNIQUE)
- `email` (TEXT UNIQUE)
- `password_hash` (TEXT)
- `display_name` (TEXT)
- `tokens` (INTEGER DEFAULT 1000)
- `points` (INTEGER DEFAULT 0)
- `created_at`, `updated_at` (DATETIME)

### Game Results
- `id` (INTEGER PRIMARY KEY)
- `user_id` (INTEGER FOREIGN KEY)
- `game_name` (TEXT)
- `won` (INTEGER, 0 or 1)
- `points_earned` (INTEGER)
- `time_taken` (REAL, nullable)
- `created_at` (DATETIME)

## Game Details

### Coin Flip
- 50/50 chance to win
- Wager: 10 tokens
- Reward: 50 points

### Number Guess
- Guess a number between 1-10
- Wager: 10 tokens
- Reward: 100 points

### Reaction Time
- Click when the box turns green
- Target: 400ms
- Wager: 15 tokens
- Reward: 75 points

### Match Cards
- Find matching emoji pairs
- Timer-based points: 150 - (time × 2), minimum 50
- Wager: 20 tokens
- Reward: up to 150 points based on speed

## Configuration

### Themes
Customize themes by editing the `themeSystem.themes` object in `script.js`:
```javascript
myTheme: {
  primary: '#color',
  secondary: '#color',
  darkBg: '#color',
  cardBg: '#color',
  border: '#color',
  textPrimary: '#color',
  textSecondary: '#color'
}
```

### Shop Pricing
Modify token pricing in `handleBuyTokens`:
```javascript
const cost = amount * 10; // 10 points per token
```

## Changelog

### v0.10 (Current)
- ✨ User role system with pyramid hierarchy: player → muted → admin → owner
- ✨ Admin panel for user management (change roles, modify tokens/points)
- 🔒 Banned users are rejected at login
- 🔒 Muted users cannot send chat messages
- 🔒 Permission system: admins cannot modify owners, only owners can create owners
- 🔧 Added role field to user authentication responses

### v0.9
- ✅ Fixed landing page leaderboard - now uses same logic as in-game modal
- 🔧 Simplified loadLeaderboard to support both containers (landing + in-game)
- 🔧 Added proper timing with init() to ensure DOM is ready

### v0.8
- 🐛 Fixed landing page leaderboard stuck on loading state
- 🐛 Moved `escapeHtml()` function earlier in script to prevent undefined errors
- 🔧 Changed leaderboard load event from `window.load` to `DOMContentLoaded` for better timing
- 🔧 Added element existence checks for robustness

### v0.7
- ✨ Added dynamic live leaderboard on landing page (fetches from `/api/leaderboard`)
- ✨ Added in-game leaderboard modal accessible to logged-in users
- ✨ Implemented in-memory chat feature (messages cached, not persisted)
- 🎨 Added leaderboard/chat button icons to header
- 🎨 Enhanced modal styling with header/close buttons for leaderboards and chat
- 🔧 Added user role system foundation (ready for implementation in next version)

### v0.6
- ✨ Added signup form with account creation
- ✨ Integrated backend authentication (register/login)
- 🔧 Updated version caching for CSS/JS files

### v0.5
- ✨ Integrated frontend with backend API
- ✨ Added game result tracking and submission
- ✨ Implemented shop modal with token purchases

## Future Enhancements

- [ ] User role system (owner/admin/player/banned) with permission checking
- [ ] Persistent chat with backend storage
- [ ] Email verification
- [ ] Seasonal leaderboards
- [ ] Achievement badges
- [ ] More games (Memory Maze, Quick Math, etc.)
- [ ] Mobile app
- [ ] Analytics dashboard
- [ ] Anti-cheat measures

## License

MIT

## Support

For issues or questions, create a GitHub issue or contact the developer.

