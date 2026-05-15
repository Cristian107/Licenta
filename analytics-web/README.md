# Explorer's Journal

Full-stack local journal and stats dashboard for Cave Explorer.

## Folder Structure

```text
Sci-Fi/
├─ Sci-Fi/
│  ├─ Assets/
│  ├─ Packages/
│  ├─ ProjectSettings/
│  └─ ...
│
├─ analytics-web/
│  ├─ backend/
│  │  ├─ app.py
│  │  ├─ database.py
│  │  ├─ seed.py
│  │  ├─ schema.sql
│  │  ├─ requirements.txt
│  │  └─ game_analytics.db
│  │
│  ├─ frontend/
│  │  ├─ package.json
│  │  ├─ vite.config.js
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ api/
│  │     │  └─ api.js
│  │     ├─ components/
│  │     │  ├─ Sidebar.jsx
│  │     │  ├─ Header.jsx
│  │     │  ├─ StatCard.jsx
│  │     │  ├─ ChartCard.jsx
│  │     │  ├─ WeaponCard.jsx
│  │     │  └─ LoadingState.jsx
│  │     ├─ pages/
│  │     │  ├─ Overview.jsx
│  │     │  ├─ MatchHistory.jsx
│  │     │  ├─ Leaderboard.jsx
│  │     │  ├─ IndividualPerformance.jsx
│  │     │  └─ Settings.jsx
│  │     ├─ styles/
│  │     │  └─ global.css
│  │     ├─ App.jsx
│  │     └─ main.jsx
│  │
│  └─ README.md
```

## Backend

```bash
cd analytics-web/backend
python -m pip install -r requirements.txt
python app.py
```

The backend runs at:

```text
http://127.0.0.1:5000
```

Health check:

```text
GET http://127.0.0.1:5000/api/health
```

SQLite database:

```text
analytics-web/backend/game_analytics.db
```

The database schema is in `backend/schema.sql`. The backend no longer inserts fake match data. It only ensures the local login accounts exist:

- `player1` / `player1`
- `player2` / `player2`
- `player3` / `player3`
- `admin1` / `admin1`
- `admin2` / `admin2`

Old demo matches are removed once on startup, then new matches are populated only by real Unity uploads.

## Frontend

```bash
cd analytics-web/frontend
npm install
npm run dev
```

The React dashboard runs at:

```text
http://localhost:5173
```

Pages:

- Overview
- Match History
- Leaderboard
- Individual Performance
- Settings

## Unity Integration

Unity script:

```text
Sci-Fi/Assets/_Project/Scripts/Analytics/AnalyticsUploader.cs
```

It sends:

```text
POST http://localhost:5000/api/matches
```

The uploader is created automatically at runtime. It sends:

- `Victory` when the player reaches `LevelExit`
- `Defeat` when the player dies in `Level_01_CrystalCaves` or `Level_02_CaveBridge`

The JSON contains:

- player username and level
- level name
- result
- score
- duration
- kills
- damage dealt / taken
- coins collected
- shots fired / hit
- weapon stats
- kill events

Login is local only and uses the shared SQLite database. Everything runs on this machine; no external services are used.
