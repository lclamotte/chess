# ChessAnalyzer

A chess companion app that connects to your Lichess and Chess.com accounts to track live games, review recent matches, and analyze your playing statistics.

## Features

### Home
- Connect your Lichess account (OAuth) and Chess.com account (public API)
- View ratings across all time controls (Bullet, Blitz, Rapid, Daily, Puzzles)
- Watch your live games in real-time with automatic position updates

### Recents
- Review your recent games from both platforms
- Step through moves with keyboard navigation (arrow keys)
- **Interactive board**: Click pieces to explore alternative lines and variations
- See Stockfish evaluation and best move arrows
- View move annotations from Lichess analysis (brilliancies, blunders, etc.)
- Switch between platforms instantly (games are cached)
- Customizable board themes (7 options)

### Stats
- View detailed playing statistics and performance metrics
- Analyze your games by time control and result

## Tech Stack

- **React 19** + **Vite** - Frontend framework
- **Zustand** - State management
- **Chess.js** - Move validation and game logic
- **Stockfish 17** - Local chess engine analysis (Web Worker)
- **Tailwind CSS** - Styling
- **React Router** - Navigation

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Integrations

- **Lichess**: OAuth 2.0 with PKCE for authentication, streaming API for live games
- **Chess.com**: Public API (no authentication required, just username)

## Keyboard Shortcuts (Recents)

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate moves |
| `↑` / `↓` | Jump to start/end |
| `Shift + →` | Follow best move into variation |
| `Shift + ←` | Return to main game line |
