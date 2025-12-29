import { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuthStore } from '../stores/authStore';
import { startLichessAuth, streamGame } from '../services/lichess';
import { CUSTOM_PIECES } from '../components/ChessPieces';

export default function Live() {
    const { isAuthenticated, user, token, playingGames, fetchPlayingGames } = useAuthStore();
    const [selectedGame, setSelectedGame] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [chess, setChess] = useState(new Chess());
    const [isPolling, setIsPolling] = useState(false);
    const streamCleanupRef = useRef(null);

    // Poll for active games every 5 seconds
    useEffect(() => {
        if (!isAuthenticated || !token) return;

        const pollGames = async () => {
            setIsPolling(true);
            await fetchPlayingGames();
            setIsPolling(false);
        };

        pollGames();
        const interval = setInterval(pollGames, 5000);

        return () => clearInterval(interval);
    }, [isAuthenticated, token, fetchPlayingGames]);

    // Auto-select first game if available
    useEffect(() => {
        if (playingGames.length > 0 && !selectedGame) {
            setSelectedGame(playingGames[0]);
        } else if (playingGames.length === 0) {
            setSelectedGame(null);
            setGameState(null);
        }
    }, [playingGames, selectedGame]);

    // Stream game updates
    useEffect(() => {
        if (!selectedGame || !token) return;

        // Clean up previous stream
        if (streamCleanupRef.current) {
            streamCleanupRef.current();
        }

        const cleanup = streamGame(
            selectedGame.gameId,
            token,
            (data) => {
                setGameState(data);

                // Update chess position from moves
                if (data.state?.moves) {
                    const newChess = new Chess();
                    const moves = data.state.moves.split(' ').filter(m => m);
                    for (const uciMove of moves) {
                        try {
                            // UCI format: e2e4 or e7e8q (with promotion)
                            const from = uciMove.slice(0, 2);
                            const to = uciMove.slice(2, 4);
                            const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

                            newChess.move({ from, to, promotion });
                        } catch (e) {
                            console.error('Failed to parse move:', uciMove, e);
                        }
                    }
                    setChess(newChess);
                }
            },
            () => {
                // Game ended
                setSelectedGame(null);
                fetchPlayingGames();
            }
        );

        streamCleanupRef.current = cleanup;

        return () => {
            if (streamCleanupRef.current) {
                streamCleanupRef.current();
            }
        };
    }, [selectedGame, token, fetchPlayingGames]);

    const formatTime = (ms) => {
        if (!ms) return '--:--';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getPlayerColor = () => {
        if (!selectedGame || !user) return 'white';
        return selectedGame.color || 'white';
    };

    const isMyTurn = () => {
        if (!gameState?.state || !selectedGame) return false;
        const playerColor = getPlayerColor();
        const turn = chess.turn();
        return (turn === 'w' && playerColor === 'white') || (turn === 'b' && playerColor === 'black');
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Live Games</h1>
                    <p className="text-slate-400">Track your active Lichess games in real-time</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'} ${isPolling ? 'animate-pulse' : ''}`}></span>
                    <span className="text-sm text-slate-400">
                        {isAuthenticated ? (playingGames.length > 0 ? `${playingGames.length} active` : 'No active games') : 'Not Connected'}
                    </span>
                </div>
            </div>

            {!isAuthenticated ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-6">🔐</div>
                    <h2 className="text-2xl font-semibold mb-4">Connect to Lichess</h2>
                    <p className="text-slate-400 mb-6 max-w-md mx-auto">
                        Authenticate with your Lichess account to automatically detect and stream your live games.
                    </p>
                    <button
                        className="btn-primary"
                        onClick={startLichessAuth}
                    >
                        Connect Lichess Account
                    </button>
                </div>
            ) : selectedGame && gameState ? (
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Board Section */}
                    <div className="lg:col-span-2">
                        <div className="glass-card p-6">
                            <div className="max-w-[500px] mx-auto">
                                <Chessboard
                                    position={chess.fen()}
                                    boardWidth={480}
                                    boardOrientation={getPlayerColor()}
                                    customDarkSquareStyle={{ backgroundColor: '#4f46e5' }}
                                    customLightSquareStyle={{ backgroundColor: '#e0e7ff' }}
                                    arePiecesDraggable={false}
                                    customPieces={CUSTOM_PIECES}
                                />
                            </div>
                            <div className="text-center mt-4">
                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${isMyTurn() ? 'bg-green-500/20 text-green-400' : 'bg-slate-700/50 text-slate-400'
                                    }`}>
                                    {isMyTurn() ? '🟢 Your turn' : '⏳ Opponent\'s turn'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Game Info Panel */}
                    <div className="space-y-4">
                        {/* Players & Time */}
                        <div className="glass-card p-4">
                            {/* Opponent */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                        {getPlayerColor() === 'white' ? '♚' : '♔'}
                                    </div>
                                    <div>
                                        <div className="font-medium">{selectedGame.opponent?.username || 'Opponent'}</div>
                                        <div className="text-sm text-slate-400">{selectedGame.opponent?.rating || '?'}</div>
                                    </div>
                                </div>
                                <div className="text-2xl font-mono font-bold">
                                    {formatTime(getPlayerColor() === 'white' ? gameState.state?.btime : gameState.state?.wtime)}
                                </div>
                            </div>
                            {/* You */}
                            <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                                        {getPlayerColor() === 'white' ? '♔' : '♚'}
                                    </div>
                                    <div>
                                        <div className="font-medium">{user?.username || 'You'}</div>
                                        <div className="text-sm text-slate-400">{selectedGame.rating || '?'}</div>
                                    </div>
                                </div>
                                <div className={`text-2xl font-mono font-bold ${isMyTurn() ? 'text-green-400' : ''}`}>
                                    {formatTime(getPlayerColor() === 'white' ? gameState.state?.wtime : gameState.state?.btime)}
                                </div>
                            </div>
                        </div>

                        {/* Move List */}
                        <div className="glass-card p-4">
                            <h3 className="font-medium mb-3">Moves</h3>
                            <div className="text-sm font-mono space-y-1 max-h-48 overflow-y-auto">
                                {chess.history().reduce((acc, move, i) => {
                                    if (i % 2 === 0) {
                                        acc.push([move]);
                                    } else {
                                        acc[acc.length - 1].push(move);
                                    }
                                    return acc;
                                }, []).map((pair, i) => (
                                    <div key={i} className="flex gap-4">
                                        <span className="text-slate-500 w-6">{i + 1}.</span>
                                        <span className="w-12">{pair[0]}</span>
                                        <span className="w-12 text-slate-400">{pair[1] || ''}</span>
                                    </div>
                                ))}
                                {chess.history().length === 0 && (
                                    <div className="text-slate-500">Game starting...</div>
                                )}
                            </div>
                        </div>

                        {/* Game Info */}
                        <div className="glass-card p-4">
                            <h3 className="font-medium mb-3">Game Info</h3>
                            <div className="text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Time Control</span>
                                    <span>{selectedGame.speed || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Variant</span>
                                    <span>{selectedGame.variant?.name || 'Standard'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Game Selector (if multiple) */}
                        {playingGames.length > 1 && (
                            <div className="glass-card p-4">
                                <h3 className="font-medium mb-3">Other Games ({playingGames.length})</h3>
                                <div className="space-y-2">
                                    {playingGames.map((game) => (
                                        <button
                                            key={game.gameId}
                                            onClick={() => setSelectedGame(game)}
                                            className={`w-full p-2 rounded text-left text-sm ${game.gameId === selectedGame.gameId
                                                ? 'bg-indigo-500/20 border border-indigo-500/30'
                                                : 'bg-slate-800/50 hover:bg-slate-700/50'
                                                }`}
                                        >
                                            vs {game.opponent?.username || 'Opponent'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-6">🎮</div>
                    <h2 className="text-2xl font-semibold mb-4">No Active Games</h2>
                    <p className="text-slate-400 mb-6">
                        Start a game on Lichess and it will appear here automatically.
                    </p>
                    <a
                        href="https://lichess.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary inline-block"
                    >
                        Play on Lichess →
                    </a>
                </div>
            )}
        </div>
    );
}
