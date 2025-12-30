import { useState } from 'react';
import { getUserGames } from '../services/lichess';
import { Chess } from 'chess.js';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

// Archetype Definitions
const ARCHETYPES = {
    GRINDER: { name: 'The Grinder', icon: '🛡️', desc: 'You excel in long games and endgames. You wear opponents down.' },
    GLASS_CANNON: { name: 'The Glass Cannon', icon: '💣', desc: 'Dangerous in the opening, but you tend to blunder in the endgame.' },
    GAMBLER: { name: 'The Gambler', icon: '🎲', desc: 'High risk, high reward. Your games are wild and chaotic.' },
    TIME_TROUBLE: { name: 'Time Addict', icon: '⏳', desc: 'You play great... until you have 10 seconds left.' },
    BALANCED: { name: 'The Tactician', icon: '⚔️', desc: 'A well-rounded solid player with no glaring weaknesses.' }
};

export default function Stats() {
    const [username, setUsername] = useState('');
    const [platform, setPlatform] = useState('lichess');
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'deepdive'
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');

    const analyzeGames = async (games) => {
        let totalGames = games.length;
        let wins = 0;
        let losses = 0;
        let draws = 0;

        const openingStats = {};
        let earlyGameMistakes = 0;
        let middleGameMistakes = 0;
        let endgameMistakes = 0;
        let timePressureBlunders = 0;

        // Color-based stats
        let whiteGames = 0;
        let whiteWins = 0;
        let blackGames = 0;
        let blackWins = 0;

        // Deep Dive Metrics
        let roiDataPoints = []; // { timeSpent, evalChange }
        let totalMoveTime = 0;
        let totalMovesMade = 0;
        let lostPositions = 0;
        let savedLostPositions = 0; // Win/Draw from < -2
        let gamesWithTimePressure = 0;
        let prevGameWasLoss = false;
        let winsAfterLoss = 0;
        let lossesAfterLoss = 0;

        // Sort games by date for Tilt Meter (oldest first)
        const chronometricGames = [...games].sort((a, b) => a.createdAt - b.createdAt);

        for (const game of chronometricGames) {
            // Determine player color
            const isWhite = game.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
            const isBlack = game.players?.black?.user?.name?.toLowerCase() === username.toLowerCase();
            const playerColor = isWhite ? 'white' : 'black';

            // General Stats
            if (isWhite) {
                whiteGames++;
                if (game.winner === 'white') whiteWins++;
            } else if (isBlack) {
                blackGames++;
                if (game.winner === 'black') blackWins++;
            }

            // Win/Loss/Draw
            let result = 'draw';
            if (game.winner === playerColor) {
                result = 'win';
                wins++;
            } else if (game.winner && game.winner !== playerColor) {
                result = 'loss';
                losses++;
            } else {
                draws++;
            }

            // Tilt Meter: Result after a loss
            if (prevGameWasLoss) {
                if (result === 'win') winsAfterLoss++;
                else if (result === 'loss') lossesAfterLoss++;
            }
            prevGameWasLoss = (result === 'loss');

            // Opening stats
            if (game.opening?.name) {
                const openingName = game.opening.name.split(':')[0].trim();
                if (!openingStats[openingName]) {
                    openingStats[openingName] = { games: 0, wins: 0 };
                }
                openingStats[openingName].games++;
                if (game.winner === playerColor) openingStats[openingName].wins++;
            }

            // Parse moves for phase analysis & ROI
            if (game.moves) {
                const hasClock = game.clocks && game.clocks.length > 0;
                const hasAnalysis = game.analysis && game.analysis.length > 0;

                // Track if this game was "Saved" (was lost at some point but not lost in end)
                let wasLost = false;

                // Simple heuristic: check for clock info if available
                if (hasClock) {
                    // Check for time pressure (any move < 30s remaining)
                    const lowTimeMoves = game.clocks.filter((c, i) => {
                        // Filter for our moves only
                        const isMyMove = isWhite ? i % 2 === 0 : i % 2 !== 0;
                        return isMyMove && c < 3000; // 30s
                    });
                    if (lowTimeMoves.length > 0) gamesWithTimePressure++;
                }

                // Game phase & ROI analysis
                if (hasAnalysis) {
                    game.analysis.forEach((moveAnalysis, i) => {
                        // Is this my move?
                        // Analysis array usually maps 1-to-1 with moves.
                        // Index 0 = White move 1. Index 1 = Black move 1.
                        const isMyMove = isWhite ? i % 2 === 0 : i % 2 !== 0;

                        // Mistake counting
                        if (isMyMove && (moveAnalysis.judgment?.name === 'Blunder' || moveAnalysis.judgment?.name === 'Mistake')) {
                            const moveNum = Math.floor(i / 2) + 1;
                            if (moveNum <= 10) earlyGameMistakes++;
                            else if (moveNum <= 30) middleGameMistakes++;
                            else endgameMistakes++;
                        }

                        // ROI Calculation (Time vs Eval Change)
                        if (isMyMove && hasClock && i > 0 && i < game.clocks.length) {
                            // Time spent = Our Previous Clock - Our Current Clock
                            // Note: game.clocks is flat array of [white, black, white, black]
                            // If i (move index) is my move, i corresponds to the clock AFTER the move.
                            // Previous clock for me was at i - 2.
                            // Actually, if i=0 (White move 1), prev clock is initial time.
                            // Let's approximate time spent using the stream of clocks.

                            // My clock index in `game.clocks` is `i`.
                            // My previous clock index is `i - 2`. If `i < 2`, use initial time (usually first clock or game setting).
                            // Safe bet: max time or just skip first move.
                            if (i >= 2) {
                                const myPrevClock = game.clocks[i - 2];
                                const myCurrClock = game.clocks[i];
                                const timeSpentSeconds = (myPrevClock - myCurrClock) / 100;

                                // Eval Change
                                // My Move is at `i`.
                                // Pos before move: `i-1` (or start if i=0). Eval `i-1`.
                                // Pos after move: `i`. Eval `i`.
                                // We need `Eval(i) - Eval(i-1)`.
                                // Note: Analysis array `eval` is typically from White's perspective.
                                const prevEvalObj = game.analysis[i - 1];
                                const currEvalObj = game.analysis[i];

                                if (prevEvalObj && currEvalObj && prevEvalObj.eval !== undefined && currEvalObj.eval !== undefined) {
                                    let evalDiff = currEvalObj.eval - prevEvalObj.eval;
                                    if (isBlack) evalDiff = -evalDiff; // Flip for black

                                    // Filter out small times/evals to reduce noise
                                    if (timeSpentSeconds > 1 && Math.abs(evalDiff) < 1000) {
                                        roiDataPoints.push({
                                            time: Math.round(timeSpentSeconds),
                                            evalChange: evalDiff / 100 // Convert to pawns
                                        });
                                    }

                                    // Resilience Check
                                    // "Lost position" = eval < -200 (from my perspective)
                                    const myEval = isWhite ? prevEvalObj.eval : -prevEvalObj.eval;
                                    if (myEval < -200) {
                                        wasLost = true;
                                    }
                                }

                                totalMoveTime += timeSpentSeconds;
                                totalMovesMade++;
                            }
                        }
                    });
                }

                if (wasLost) {
                    lostPositions++;
                    if (result === 'win' || result === 'draw') {
                        savedLostPositions++;
                    }
                }
            }
        }

        // Determine Archetype
        let archetype = ARCHETYPES.BALANCED;
        const avgGameLength = games.length > 0 ? games.reduce((acc, g) => acc + (g.turns || 0), 0) / games.length : 0;
        const timePressureRate = gamesWithTimePressure / totalGames;
        const endgameMistakeRate = endgameMistakes / totalGames;
        const openingMistakeRate = earlyGameMistakes / totalGames;

        if (timePressureRate > 0.4) archetype = ARCHETYPES.TIME_TROUBLE;
        else if (avgGameLength > 60 && endgameMistakeRate < 0.5) archetype = ARCHETYPES.GRINDER; // Arbitrary thresholds
        else if (openingMistakeRate < 0.3 && endgameMistakeRate > 1.0) archetype = ARCHETYPES.GLASS_CANNON;
        else if (savedLostPositions / (lostPositions || 1) > 0.3) archetype = ARCHETYPES.GAMBLER; // High resilience/chaos


        // Calculate top openings
        const openingsArray = Object.entries(openingStats)
            .map(([name, data]) => ({
                name,
                games: data.games,
                winRate: Math.round((data.wins / data.games) * 100),
            }))
            .sort((a, b) => b.games - a.games)
            .slice(0, 5);

        return {
            totalGames,
            wins,
            losses,
            draws,
            winRate: totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : 0,
            drawRate: totalGames > 0 ? ((draws / totalGames) * 100).toFixed(1) : 0,
            lossRate: totalGames > 0 ? ((losses / totalGames) * 100).toFixed(1) : 0,
            whiteWinRate: whiteGames > 0 ? ((whiteWins / whiteGames) * 100).toFixed(1) : 0,
            blackWinRate: blackGames > 0 ? ((blackWins / blackGames) * 100).toFixed(1) : 0,
            openings: openingsArray,
            timePressureBlunders,
            earlyGameMistakes,
            middleGameMistakes,
            endgameMistakes,
            // New Metrics
            roiDataPoints: roiDataPoints.slice(0, 200), // Limit points for performance
            archetype,
            resilienceScore: lostPositions > 0 ? Math.round((savedLostPositions / lostPositions) * 100) : 0,
            tiltRatio: lossesAfterLoss > 0 ? (winsAfterLoss / lossesAfterLoss).toFixed(2) : winsAfterLoss > 0 ? 'Infinite' : '0.00',
            winsAfterLoss,
            lossesAfterLoss
        };
    };

    const fetchStats = async () => {
        if (!username.trim()) return;

        setIsLoading(true);
        setError(null);
        setProgress('Fetching games...');

        try {
            if (platform === 'lichess') {
                const games = await getUserGames(username, { max: 100 });
                setProgress(`Analyzing ${games.length} games...`);

                const analyzedStats = await analyzeGames(games);
                setStats(analyzedStats);
            } else {
                // Chess.com API
                setProgress('Fetching from Chess.com...');
                const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
                if (!response.ok) throw new Error('Player not found');

                const { archives } = await response.json();
                // Get last 2 months of games
                const recentArchives = archives.slice(-2);
                let allGames = [];

                for (const archiveUrl of recentArchives) {
                    const archiveResponse = await fetch(archiveUrl);
                    const { games } = await archiveResponse.json();
                    allGames = allGames.concat(games || []);
                }

                setProgress(`Analyzing ${allGames.length} games...`);

                // Convert Chess.com format to our analysis format
                const convertedGames = allGames.slice(-100).map(game => {
                    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
                    return {
                        players: {
                            white: { user: { name: game.white.username } },
                            black: { user: { name: game.black.username } },
                        },
                        winner: game.white.result === 'win' ? 'white' : game.black.result === 'win' ? 'black' : null,
                        opening: { name: game.eco || 'Unknown' },
                        moves: game.pgn || '',
                    };
                });

                const analyzedStats = await analyzeGames(convertedGames);
                setStats(analyzedStats);
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch games');
            setStats(null);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header with Tabs */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Analysis Hub</h1>
                    <p className="text-slate-400">Descriptive and behavioral analytics for your chess improvement</p>
                </div>
                {stats && (
                    <div className="flex bg-slate-800/50 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 rounded-md transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('deepdive')}
                            className={`px-4 py-2 rounded-md transition-all ${activeTab === 'deepdive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Deep Dive
                        </button>
                    </div>
                )}
            </div>

            {/* Username Input */}
            <div className="glass-card p-6 mb-8">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-slate-400 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchStats()}
                            placeholder="Enter username..."
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 focus:border-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Platform</label>
                        <select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="lichess">Lichess</option>
                            <option value="chesscom">Chess.com</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="btn-primary"
                        disabled={isLoading || !username.trim()}
                    >
                        {isLoading ? 'Analyzing...' : 'Analyze Games'}
                    </button>
                </div>
                {error && (
                    <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="text-center py-12">
                    <div className="text-6xl animate-pulse mb-4">♟</div>
                    <p className="text-slate-400">{progress || 'Analyzing your games...'}</p>
                </div>
            )}



            {/* DEEP DIVE TAB */}
            {
                stats && !isLoading && activeTab === 'deepdive' && (
                    <div className="space-y-6 animate-fade-in">

                        {/* Archetype Card */}
                        <div className="glass-card p-8 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30">
                            <div className="flex items-center gap-6">
                                <div className="text-6xl bg-slate-900/50 w-24 h-24 flex items-center justify-center rounded-2xl shadow-xl">
                                    {stats.archetype.icon}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-2">{stats.archetype.name}</h2>
                                    <p className="text-lg text-indigo-200">{stats.archetype.desc}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* ROI Analysis */}
                            <div className="glass-card p-6">
                                <h3 className="text-xl font-semibold mb-2">🧠 ROI on Think Time</h3>
                                <p className="text-xs text-slate-400 mb-4">Correlation between time spent on a move and evaluation change.</p>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                type="number"
                                                dataKey="time"
                                                name="Time"
                                                unit="s"
                                                stroke="#94a3b8"
                                                label={{ value: 'Time Spent (s)', position: 'insideBottom', offset: -10, fill: '#64748b' }}
                                            />
                                            <YAxis
                                                type="number"
                                                dataKey="evalChange"
                                                name="Eval"
                                                stroke="#94a3b8"
                                                label={{ value: 'Eval Change', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                            />
                                            <Tooltip
                                                cursor={{ strokeDasharray: '3 3' }}
                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                            />
                                            <Scatter name="Moves" data={stats.roiDataPoints} fill="#8884d8">
                                                {stats.roiDataPoints.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.evalChange > 0 ? '#4ade80' : '#f87171'} />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="text-center text-xs text-slate-500 mt-2">
                                    <span className="text-green-400">● Improved Position</span> <span className="mx-2">|</span> <span className="text-red-400">● Worsened Position</span>
                                </div>
                            </div>

                            {/* Psychometrics */}
                            <div className="space-y-6">
                                {/* Tilt Meter */}
                                <div className="glass-card p-6">
                                    <h3 className="text-xl font-semibold mb-4">🌡️ Tilt Meter</h3>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-slate-400 mb-1">Performance after a Loss</div>
                                            <div className="text-2xl font-bold">
                                                {stats.winsAfterLoss}W - {stats.lossesAfterLoss}L
                                            </div>
                                        </div>
                                        <div className={`text-xl font-bold px-4 py-2 rounded-lg ${parseFloat(stats.tiltRatio) < 0.8 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {parseFloat(stats.tiltRatio) < 0.8 ? '😡 TILTED' : '🧘 ZEN'}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-4">
                                        {parseFloat(stats.tiltRatio) < 0.8
                                            ? "You tend to lose more often immediately after a loss. Take a break!"
                                            : "You bounce back well after defeats."}
                                    </p>
                                </div>

                                {/* Resilience */}
                                <div className="glass-card p-6">
                                    <h3 className="text-xl font-semibold mb-4">🛡️ Resilience Score</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-1000"
                                                    style={{ width: `${stats.resilienceScore}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="font-mono text-xl font-bold text-orange-400">
                                            {stats.resilienceScore}/100
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Percentage of games saved (Win/Draw) from a lost position (eval &lt; -2.0).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* OVERVIEW TAB CONTENT (Wrapped) */}
            {
                stats && !isLoading && activeTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Overview Stats */}
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="glass-card p-6 text-center">
                                <div className="text-3xl font-bold text-indigo-400">{stats.totalGames}</div>
                                <div className="text-sm text-slate-400">Games Analyzed</div>
                            </div>
                            <div className="glass-card p-6 text-center">
                                <div className="text-3xl font-bold text-green-400">{stats.winRate}%</div>
                                <div className="text-sm text-slate-400">Win Rate</div>
                            </div>
                            <div className="glass-card p-6 text-center">
                                <div className="text-3xl font-bold text-yellow-400">{stats.drawRate}%</div>
                                <div className="text-sm text-slate-400">Draw Rate</div>
                            </div>
                            <div className="glass-card p-6 text-center">
                                <div className="text-3xl font-bold text-red-400">{stats.lossRate}%</div>
                                <div className="text-sm text-slate-400">Loss Rate</div>
                            </div>
                        </div>

                        {/* Color Stats */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="glass-card p-6">
                                <h3 className="text-xl font-semibold mb-4">Performance by Color</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">♔</span>
                                            <span>Playing White</span>
                                        </div>
                                        <span className={`font-mono font-bold text-xl ${parseFloat(stats.whiteWinRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                            {stats.whiteWinRate}%
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">♚</span>
                                            <span>Playing Black</span>
                                        </div>
                                        <span className={`font-mono font-bold text-xl ${parseFloat(stats.blackWinRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                            {stats.blackWinRate}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card p-6">
                                <h3 className="text-xl font-semibold mb-4">Mistakes by Game Phase</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                        <span>Opening (moves 1-10)</span>
                                        <span className="font-mono text-yellow-400">{stats.earlyGameMistakes}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                        <span>Middlegame (moves 11-30)</span>
                                        <span className="font-mono text-orange-400">{stats.middleGameMistakes}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                        <span>Endgame (moves 31+)</span>
                                        <span className="font-mono text-red-400">{stats.endgameMistakes}</span>
                                    </div>
                                </div>
                                {stats.earlyGameMistakes + stats.middleGameMistakes + stats.endgameMistakes === 0 && (
                                    <p className="text-sm text-slate-500 mt-4">
                                        Note: Mistake analysis requires games with computer analysis from Lichess.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Time Pressure & Openings */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="glass-card p-6">
                                <h3 className="text-xl font-semibold mb-4">⏱ Time Pressure Impact</h3>
                                <div className="text-center py-6">
                                    <div className="text-5xl font-bold text-red-400 mb-2">{stats.timePressureBlunders}</div>
                                    <p className="text-slate-400">Games with time pressure (under 30 seconds)</p>
                                </div>
                                <p className="text-sm text-slate-500 text-center">
                                    {stats.totalGames > 0
                                        ? `${Math.round(stats.timePressureBlunders / stats.totalGames * 100)}% of games had time pressure situations.`
                                        : 'No games analyzed yet.'}
                                </p>
                            </div>

                            <div className="glass-card p-6">
                                <h3 className="text-xl font-semibold mb-4">📖 Top Openings</h3>
                                {stats.openings.length > 0 ? (
                                    <div className="space-y-3">
                                        {stats.openings.map((opening, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                                <div>
                                                    <div className="font-medium">{opening.name}</div>
                                                    <div className="text-sm text-slate-400">{opening.games} games</div>
                                                </div>
                                                <div className={`font-mono font-bold ${opening.winRate >= 55 ? 'text-green-400' : opening.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {opening.winRate}%
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-center py-4">No opening data available</p>
                                )}
                            </div>
                        </div>

                        {/* Win/Loss/Draw Breakdown */}
                        <div className="glass-card p-6">
                            <h3 className="text-xl font-semibold mb-4">Game Results</h3>
                            <div className="flex gap-2 h-8 rounded-lg overflow-hidden">
                                <div
                                    className="bg-green-500 flex items-center justify-center text-sm font-medium"
                                    style={{ width: `${stats.winRate}%` }}
                                >
                                    {parseFloat(stats.winRate) > 10 && `${stats.wins}W`}
                                </div>
                                <div
                                    className="bg-yellow-500 flex items-center justify-center text-sm font-medium"
                                    style={{ width: `${stats.drawRate}%` }}
                                >
                                    {parseFloat(stats.drawRate) > 10 && `${stats.draws}D`}
                                </div>
                                <div
                                    className="bg-red-500 flex items-center justify-center text-sm font-medium"
                                    style={{ width: `${stats.lossRate}%` }}
                                >
                                    {parseFloat(stats.lossRate) > 10 && `${stats.losses}L`}
                                </div>
                            </div>
                            <div className="flex justify-between text-sm text-slate-400 mt-2">
                                <span>{stats.wins} Wins</span>
                                <span>{stats.draws} Draws</span>
                                <span>{stats.losses} Losses</span>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                !stats && !isLoading && (
                    <div className="glass-card p-12 text-center">
                        <div className="text-6xl mb-6">📊</div>
                        <h2 className="text-2xl font-semibold mb-4">Ready to Analyze</h2>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Enter your username and select a platform to analyze your game history and discover insights.
                        </p>
                    </div>
                )
            }
        </div >
    );
}
