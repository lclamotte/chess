import { useState } from 'react';
import { getUserGames } from '../services/lichess';
import { Chess } from 'chess.js';

export default function Stats() {
    const [username, setUsername] = useState('');
    const [platform, setPlatform] = useState('lichess');
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

        for (const game of games) {
            // Determine player color
            const isWhite = game.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
            const isBlack = game.players?.black?.user?.name?.toLowerCase() === username.toLowerCase();

            if (isWhite) {
                whiteGames++;
                if (game.winner === 'white') whiteWins++;
            } else if (isBlack) {
                blackGames++;
                if (game.winner === 'black') blackWins++;
            }

            // Win/Loss/Draw
            const playerColor = isWhite ? 'white' : 'black';
            if (game.winner === playerColor) wins++;
            else if (game.winner && game.winner !== playerColor) losses++;
            else draws++;

            // Opening stats
            if (game.opening?.name) {
                const openingName = game.opening.name.split(':')[0].trim();
                if (!openingStats[openingName]) {
                    openingStats[openingName] = { games: 0, wins: 0 };
                }
                openingStats[openingName].games++;
                if (game.winner === playerColor) openingStats[openingName].wins++;
            }

            // Parse moves for phase analysis
            if (game.moves) {
                const moves = game.moves.split(' ');
                const totalMoves = moves.length;

                // Simple heuristic: check for clock info if available
                if (game.clocks && game.clocks.length > 0) {
                    const lastClock = game.clocks[game.clocks.length - 1];
                    if (lastClock < 3000) { // Less than 30 seconds
                        timePressureBlunders++;
                    }
                }

                // Game phase analysis (simple move count heuristic)
                if (game.analysis) {
                    game.analysis.forEach((moveAnalysis, i) => {
                        if (moveAnalysis.judgment?.name === 'Blunder' || moveAnalysis.judgment?.name === 'Mistake') {
                            const moveNum = Math.floor(i / 2);
                            if (moveNum <= 10) earlyGameMistakes++;
                            else if (moveNum <= 30) middleGameMistakes++;
                            else endgameMistakes++;
                        }
                    });
                }
            }
        }

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
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Deep Analysis</h1>
                <p className="text-slate-400">Discover patterns and insights from your game history</p>
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

            {stats && !isLoading && (
                <div className="space-y-6">
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
            )}

            {!stats && !isLoading && (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-6">📊</div>
                    <h2 className="text-2xl font-semibold mb-4">Ready to Analyze</h2>
                    <p className="text-slate-400 max-w-md mx-auto">
                        Enter your username and select a platform to analyze your game history and discover insights.
                    </p>
                </div>
            )}
        </div>
    );
}
