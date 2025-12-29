import { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { useAuthStore } from '../stores/authStore';
import { startLichessAuth, getUserGames } from '../services/lichess';
import { PIECE_SVGS } from '../components/ChessPieces';

export default function Recents() {
    const { isAuthenticated, user, token } = useAuthStore();
    const [games, setGames] = useState([]);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const [error, setError] = useState(null);
    const [boardPosition, setBoardPosition] = useState('start');
    const [lastMoveSquares, setLastMoveSquares] = useState(null);

    // Fetch recent games
    useEffect(() => {
        if (!isAuthenticated || !user) return;

        const fetchRecentGames = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedGames = await getUserGames(user.username, { max: 20 });

                // Filter to today's games or last session
                const now = Date.now();
                const todayStart = new Date().setHours(0, 0, 0, 0);

                let recentGames = fetchedGames.filter(g => g.createdAt >= todayStart);

                // If no games today, get the most recent session (games within 2 hours of each other)
                if (recentGames.length === 0 && fetchedGames.length > 0) {
                    const lastGameTime = fetchedGames[0].createdAt;
                    recentGames = fetchedGames.filter(g =>
                        Math.abs(g.createdAt - lastGameTime) < 2 * 60 * 60 * 1000
                    );
                }

                setGames(recentGames.length > 0 ? recentGames : fetchedGames.slice(0, 10));
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecentGames();
    }, [isAuthenticated, user]);

    // Parse game moves and clocks
    const gameData = useMemo(() => {
        if (!selectedGame) return null;

        const chess = new Chess();
        const positions = [{ fen: chess.fen(), move: null, clock: null, lastMove: null }];
        const moves = selectedGame.moves?.split(' ').filter(m => m) || [];
        const clocks = selectedGame.clocks || [];

        moves.forEach((moveStr, i) => {
            try {
                // Lichess game history API returns moves in SAN format (e4, Nf3, etc.)
                // Try SAN first, then fall back to UCI format
                let moveResult;

                // Check if it looks like UCI (4-5 chars, all lowercase letters/numbers)
                const isUci = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveStr);

                if (isUci) {
                    const from = moveStr.slice(0, 2);
                    const to = moveStr.slice(2, 4);
                    const promotion = moveStr.length > 4 ? moveStr[4] : undefined;
                    moveResult = chess.move({ from, to, promotion });
                } else {
                    // SAN format
                    moveResult = chess.move(moveStr);
                }

                if (moveResult) {
                    positions.push({
                        fen: chess.fen(),
                        move: moveResult,
                        clock: clocks[i] ? clocks[i] : null,
                        lastMove: [moveResult.from, moveResult.to],
                    });
                }
            } catch (e) {
                console.error('Failed to parse move:', moveStr, e);
            }
        });

        return { positions, finalChess: chess };
    }, [selectedGame]);

    // Calculate captured pieces at current position
    const capturedPieces = useMemo(() => {
        if (!gameData || currentMoveIndex < 0) {
            return { white: [], black: [] };
        }

        const position = gameData.positions[currentMoveIndex + 1]?.fen || gameData.positions[0].fen;
        const chess = new Chess(position);
        const board = chess.board().flat().filter(p => p);

        const initialPieces = {
            white: { p: 8, n: 2, b: 2, r: 2, q: 1 },
            black: { p: 8, n: 2, b: 2, r: 2, q: 1 },
        };

        const currentPieces = { white: {}, black: {} };
        for (const piece of board) {
            const color = piece.color === 'w' ? 'white' : 'black';
            currentPieces[color][piece.type] = (currentPieces[color][piece.type] || 0) + 1;
        }

        const captured = { white: [], black: [] };
        for (const type of ['q', 'r', 'b', 'n', 'p']) {
            const whiteLost = (initialPieces.white[type] || 0) - (currentPieces.white[type] || 0);
            const blackLost = (initialPieces.black[type] || 0) - (currentPieces.black[type] || 0);

            for (let i = 0; i < whiteLost; i++) captured.white.push(type);
            for (let i = 0; i < blackLost; i++) captured.black.push(type);
        }

        return captured;
    }, [gameData, currentMoveIndex]);

    const formatClock = (centiseconds) => {
        if (!centiseconds) return '--:--';
        const totalSeconds = Math.floor(centiseconds / 100);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };


    const getPlayerColor = () => {
        if (!selectedGame || !user) return 'white';
        return selectedGame.players?.white?.user?.name?.toLowerCase() === user.username.toLowerCase() ? 'white' : 'black';
    };

    const getCurrentClock = (color) => {
        if (!gameData || currentMoveIndex < 0) return null;
        const clocks = selectedGame.clocks || [];
        // White moves are even indices (0, 2, 4...), black moves are odd (1, 3, 5...)
        const colorOffset = color === 'white' ? 0 : 1;
        for (let i = currentMoveIndex; i >= 0; i--) {
            if (i % 2 === colorOffset) {
                return clocks[i];
            }
        }
        return null;
    };

    const goToMove = (index) => setCurrentMoveIndex(index);
    const goFirst = () => setCurrentMoveIndex(-1);
    const goPrev = () => setCurrentMoveIndex(Math.max(-1, currentMoveIndex - 1));
    const goNext = () => setCurrentMoveIndex(Math.min((gameData?.positions.length || 1) - 2, currentMoveIndex + 1));
    const goLast = () => setCurrentMoveIndex((gameData?.positions.length || 1) - 2);

    // Memoized position to ensure react-chessboard gets updated values
    const currentPosition = useMemo(() => {
        if (!gameData || !gameData.positions) return 'start';
        const pos = gameData.positions[currentMoveIndex + 1];
        console.log('useMemo computed position:', currentMoveIndex, pos?.fen);
        return pos?.fen || 'start';
    }, [gameData, currentMoveIndex]);

    const currentLastMove = useMemo(() => {
        if (!gameData || !gameData.positions) return null;
        const pos = gameData.positions[currentMoveIndex + 1];
        return pos?.lastMove || null;
    }, [gameData, currentMoveIndex]);

    const renderBoard = () => {
        const chess = new Chess(currentPosition);
        const board = chess.board();
        const orientation = getPlayerColor();

        // If black, reverse the rows and for each row reverse the squares
        const displayBoard = orientation === 'white'
            ? board
            : [...board].reverse().map(row => [...row].reverse());

        return (
            <div className="grid grid-cols-8 border-2 border-slate-700 bg-slate-800">
                {displayBoard.map((row, rankIdx) => (
                    row.map((square, fileIdx) => {
                        const isLight = (rankIdx + fileIdx) % 2 === 0;
                        const rank = orientation === 'white' ? 8 - rankIdx : rankIdx + 1;
                        const file = orientation === 'white'
                            ? String.fromCharCode(97 + fileIdx)
                            : String.fromCharCode(104 - fileIdx);
                        const squareName = `${file}${rank}`;

                        const isLastMove = currentLastMove && (currentLastMove[0] === squareName || currentLastMove[1] === squareName);

                        return (
                            <div
                                key={`${rank}-${file}`}
                                className={`
                                    aspect-square flex items-center justify-center text-4xl select-none relative
                                    ${isLight ? 'bg-[#e0e7ff] text-slate-800' : 'bg-[#4f46e5] text-white'}
                                    ${isLastMove ? 'after:absolute after:inset-0 after:bg-yellow-400/40' : ''}
                                `}
                            >
                                {square && (
                                    <svg viewBox="0 0 45 45" className="w-full h-full p-1 drop-shadow-sm">
                                        {PIECE_SVGS[square.color === 'w' ? 'white' : 'black'][square.type]}
                                    </svg>
                                )}

                                {/* Coordinates */}
                                {fileIdx === 0 && (
                                    <span className="absolute top-0.5 left-0.5 text-[10px] opacity-50 font-mono">
                                        {rank}
                                    </span>
                                )}
                                {rankIdx === 7 && (
                                    <span className="absolute bottom-0.5 right-0.5 text-[10px] opacity-50 font-mono">
                                        {file}
                                    </span>
                                )}
                            </div>
                        );
                    })
                ))}
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Recent Games</h1>
                <p className="text-slate-400">Review your latest session with full game replay</p>
            </div>

            {!isAuthenticated ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-6">🔐</div>
                    <h2 className="text-2xl font-semibold mb-4">Connect to Lichess</h2>
                    <p className="text-slate-400 mb-6 max-w-md mx-auto">
                        Authenticate with your Lichess account to view your recent games.
                    </p>
                    <button className="btn-primary" onClick={startLichessAuth}>
                        Connect Lichess Account
                    </button>
                </div>
            ) : isLoading ? (
                <div className="text-center py-12">
                    <div className="text-6xl animate-pulse mb-4">♟</div>
                    <p className="text-slate-400">Loading your recent games...</p>
                </div>
            ) : error ? (
                <div className="glass-card p-8 text-center">
                    <p className="text-red-400">{error}</p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-4 gap-6">
                    {/* Game List */}
                    <div className="lg:col-span-1 space-y-2">
                        <h3 className="font-medium text-slate-400 mb-3">
                            {games.length} Game{games.length !== 1 ? 's' : ''} from Session
                        </h3>
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {games.map((game, i) => {
                                const isWhite = game.players?.white?.user?.name?.toLowerCase() === user?.username?.toLowerCase();
                                const opponent = isWhite ? game.players?.black : game.players?.white;
                                const result = game.winner === (isWhite ? 'white' : 'black') ? 'win' :
                                    game.winner ? 'loss' : 'draw';

                                return (
                                    <button
                                        key={game.id}
                                        onClick={() => { setSelectedGame(game); setCurrentMoveIndex(-1); }}
                                        className={`w-full p-3 rounded-lg text-left transition-all ${selectedGame?.id === game.id
                                            ? 'bg-indigo-500/20 border border-indigo-500/30'
                                            : 'bg-slate-800/50 hover:bg-slate-700/50 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-sm">{opponent?.user?.name || 'Opponent'}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${result === 'win' ? 'bg-green-500/20 text-green-400' :
                                                result === 'loss' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {result.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>{isWhite ? '♔ White' : '♚ Black'}</span>
                                            <span>{formatTime(game.createdAt)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                            {games.length === 0 && (
                                <div className="text-center text-slate-500 py-8">
                                    No recent games found
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Game Replay */}
                    <div className="lg:col-span-3">
                        {selectedGame ? (
                            <div className="grid lg:grid-cols-3 gap-6">
                                {/* Board */}
                                <div className="lg:col-span-2">
                                    <div className="glass-card p-6">
                                        <div className="max-w-[500px] mx-auto">
                                            {renderBoard()}
                                        </div>

                                        {/* Navigation Controls */}
                                        <div className="flex items-center justify-center gap-2 mt-6">
                                            <button onClick={goFirst} className="btn-secondary px-3 py-2">⏮</button>
                                            <button onClick={goPrev} className="btn-secondary px-4 py-2">←</button>
                                            <span className="px-4 py-2 text-sm text-slate-400 min-w-[80px] text-center">
                                                {currentMoveIndex + 1} / {(gameData?.positions.length || 1) - 1}
                                            </span>
                                            <button onClick={goNext} className="btn-secondary px-4 py-2">→</button>
                                            <button onClick={goLast} className="btn-secondary px-3 py-2">⏭</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Game Info Panel */}
                                <div className="space-y-4">
                                    {/* Players & Clocks */}
                                    <div className="glass-card p-4">
                                        {/* Opponent */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                                    {getPlayerColor() === 'white' ? '♚' : '♔'}
                                                </div>
                                                <div>
                                                    <div className="font-medium">
                                                        {getPlayerColor() === 'white'
                                                            ? selectedGame.players?.black?.user?.name
                                                            : selectedGame.players?.white?.user?.name}
                                                    </div>
                                                    <div className="text-sm text-slate-400">
                                                        {getPlayerColor() === 'white'
                                                            ? selectedGame.players?.black?.rating
                                                            : selectedGame.players?.white?.rating}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xl font-mono font-bold">
                                                {formatClock(getCurrentClock(getPlayerColor() === 'white' ? 'black' : 'white'))}
                                            </div>
                                        </div>
                                        {/* You */}
                                        <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                                                    {getPlayerColor() === 'white' ? '♔' : '♚'}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{user?.username}</div>
                                                    <div className="text-sm text-slate-400">
                                                        {getPlayerColor() === 'white'
                                                            ? selectedGame.players?.white?.rating
                                                            : selectedGame.players?.black?.rating}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xl font-mono font-bold text-indigo-400">
                                                {formatClock(getCurrentClock(getPlayerColor()))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Captured Pieces */}
                                    <div className="glass-card p-4">
                                        <h3 className="font-medium mb-3">Captured Pieces</h3>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-sm w-16">White lost:</span>
                                                <div className="flex -space-x-2">
                                                    {capturedPieces.white.map((p, i) => (
                                                        <svg key={i} viewBox="0 0 45 45" className="w-8 h-8">
                                                            {PIECE_SVGS.white[p]}
                                                        </svg>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-sm w-16">Black lost:</span>
                                                <div className="flex -space-x-2">
                                                    {capturedPieces.black.map((p, i) => (
                                                        <svg key={i} viewBox="0 0 45 45" className="w-8 h-8">
                                                            {PIECE_SVGS.black[p]}
                                                        </svg>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Move List */}
                                    <div className="glass-card p-4">
                                        <h3 className="font-medium mb-3">Moves</h3>
                                        <div className="text-sm font-mono space-y-1 max-h-48 overflow-y-auto">
                                            {gameData?.positions.slice(1).reduce((acc, pos, i) => {
                                                if (i % 2 === 0) {
                                                    acc.push([pos.move]);
                                                } else {
                                                    acc[acc.length - 1].push(pos.move);
                                                }
                                                return acc;
                                            }, []).map((pair, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <span className="text-slate-500 w-6">{i + 1}.</span>
                                                    <button
                                                        onClick={() => goToMove(i * 2)}
                                                        className={`w-14 text-left hover:text-indigo-400 ${currentMoveIndex === i * 2 ? 'text-indigo-400 font-bold' : ''}`}
                                                    >
                                                        {pair[0]?.san}
                                                    </button>
                                                    {pair[1] && (
                                                        <button
                                                            onClick={() => goToMove(i * 2 + 1)}
                                                            className={`w-14 text-left hover:text-indigo-400 ${currentMoveIndex === i * 2 + 1 ? 'text-indigo-400 font-bold' : ''}`}
                                                        >
                                                            {pair[1]?.san}
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Game Result */}
                                    <div className="glass-card p-4 text-center">
                                        <div className={`text-lg font-bold ${selectedGame.winner === getPlayerColor() ? 'text-green-400' :
                                            selectedGame.winner ? 'text-red-400' : 'text-yellow-400'
                                            }`}>
                                            {selectedGame.winner === getPlayerColor() ? '🏆 Victory!' :
                                                selectedGame.winner ? '💔 Defeat' : '🤝 Draw'}
                                        </div>
                                        <div className="text-sm text-slate-400 mt-1">
                                            {selectedGame.status}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card p-12 text-center">
                                <div className="text-6xl mb-6">👈</div>
                                <h2 className="text-2xl font-semibold mb-4">Select a Game</h2>
                                <p className="text-slate-400">
                                    Choose a game from your recent session to replay it move by move.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
