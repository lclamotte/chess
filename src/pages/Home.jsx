import { useAuthStore } from '../stores/authStore';
import { startLichessAuth, streamGame } from '../services/lichess';
import { useEffect, useState, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { CUSTOM_PIECES } from '../components/ChessPieces';

export default function Home() {
    const {
        isAuthenticated, user, token, playingGames, fetchPlayingGames,
        loadProfile, logout,
        chesscomUsername, chesscomUser, setChesscomUsername, loadChesscomProfile, clearChesscomAccount,
        isLoading, error
    } = useAuthStore();

    const [chesscomInput, setChesscomInput] = useState('');
    const [chesscomError, setChesscomError] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Live Games State (from Live.jsx)
    const [selectedLiveGame, setSelectedLiveGame] = useState(null);
    const [liveGameState, setLiveGameState] = useState(null);
    const [liveChess, setLiveChess] = useState(new Chess());
    const [isPollingLive, setIsPollingLive] = useState(false);
    const streamCleanupRef = useRef(null);

    const hasAnyAccount = isAuthenticated || !!chesscomUsername;
    const selectedLiveLiveGameId = () => selectedLiveGame?.gameId || selectedLiveGame?.id;

    // Load profiles when authenticated but user not yet loaded
    useEffect(() => {
        if (isAuthenticated && !user) {
            loadProfile();
        }
        if (chesscomUsername && !chesscomUser) {
            loadChesscomProfile();
        }
    }, [isAuthenticated, user, loadProfile, chesscomUsername, chesscomUser, loadChesscomProfile]);

    // Live Games Effects (from Live.jsx)
    useEffect(() => {
        if (!hasAnyAccount) return;

        const pollGames = async () => {
            setIsPollingLive(true);
            await fetchPlayingGames();
            setIsPollingLive(false);
        };

        pollGames();
        const interval = setInterval(pollGames, 10000); // Poll less frequently for combined sources

        return () => clearInterval(interval);
    }, [hasAnyAccount, fetchPlayingGames]);

    useEffect(() => {
        if (playingGames.length > 0 && !selectedLiveGame) {
            setSelectedLiveGame(playingGames[0]);
        } else if (playingGames.length === 0) {
            setSelectedLiveGame(null);
            setLiveGameState(null);
        }
    }, [playingGames, selectedLiveGame]);

    useEffect(() => {
        if (!selectedLiveGame) return;

        if (streamCleanupRef.current) {
            streamCleanupRef.current();
            streamCleanupRef.current = null;
        }

        // Handle Chess.com Games (Static/Polling)
        if (selectedLiveGame.source === 'chesscom') {
            setLiveGameState(selectedLiveGame); // Chess.com games come with state pre-populated
            const newChess = new Chess();
            try {
                if (selectedLiveGame.fen) {
                    newChess.load(selectedLiveGame.fen);
                } else if (selectedLiveGame.pgn) {
                    newChess.loadPgn(selectedLiveGame.pgn);
                }
            } catch (e) {
                console.error('Failed to load Chess.com game:', e);
            }
            setLiveChess(newChess);
            return;
        }

        // Handle Lichess Games (Streaming)
        if (token) {
            const cleanup = streamGame(
                selectedLiveLiveGameId(),
                token,
                (data) => {
                    setLiveGameState(data);
                    if (data.state?.moves) {
                        const newChess = new Chess();
                        const moves = data.state.moves.split(' ').filter(m => m);
                        for (const uciMove of moves) {
                            try {
                                const from = uciMove.slice(0, 2);
                                const to = uciMove.slice(2, 4);
                                const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
                                newChess.move({ from, to, promotion });
                            } catch (e) {
                                console.error('Failed to parse move:', uciMove, e);
                            }
                        }
                        setLiveChess(newChess);
                    }
                },
                () => {
                    setSelectedLiveGame(null);
                    fetchPlayingGames();
                }
            );

            streamCleanupRef.current = cleanup;
        }

        return () => {
            if (streamCleanupRef.current) {
                streamCleanupRef.current();
            }
        };
    }, [selectedLiveGame, token, fetchPlayingGames]);


    const formatLiveTime = (ms) => {
        if (ms === undefined || ms === null) return '0:00';

        const seconds = Math.floor(ms / 1000);
        if (seconds > 86400) {
            return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
        }
        if (seconds > 3600) {
            return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        }

        const minutes = Math.floor(seconds / 60);
        const remSeconds = seconds % 60;
        return `${minutes}:${remSeconds.toString().padStart(2, '0')}`;
    };

    const getCapturedPieces = (chess) => {
        const history = chess.board();
        const counts = {
            w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
            b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
        };

        for (const row of history) {
            for (const piece of row) {
                if (piece) {
                    counts[piece.color][piece.type]--;
                }
            }
        }

        const captured = { w: [], b: [] };
        const order = ['q', 'r', 'b', 'n', 'p'];

        for (const color of ['w', 'b']) {
            for (const type of order) {
                for (let i = 0; i < counts[color][type]; i++) {
                    captured[color].push(type);
                }
            }
        }

        return captured;
    };

    const PIECE_SYMBOLS = {
        p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
    };

    const getLivePlayerColor = () => {
        if (!selectedLiveGame) return 'white';
        if (selectedLiveGame.source === 'chesscom' && selectedLiveGame.color) {
            return selectedLiveGame.color;
        }
        if (!user) return 'white';
        return selectedLiveGame.color || 'white';
    };

    const isLiveMyTurn = () => {
        if (!liveGameState?.state || !selectedLiveGame) return false;
        const playerColor = getLivePlayerColor();
        const turn = liveChess.turn();
        return (turn === 'w' && playerColor === 'white') || (turn === 'b' && playerColor === 'black');
    };

    // Lichess rating modes
    const lichessRatingModes = [
        { key: 'bullet', label: 'Bullet', icon: '⚪' },
        { key: 'blitz', label: 'Blitz', icon: '⚡' },
        { key: 'rapid', label: 'Rapid', icon: '🕐' },
        { key: 'classical', label: 'Classical', icon: '♛' },
        { key: 'correspondence', label: 'Daily', icon: '📬' },
        { key: 'puzzle', label: 'Puzzles', icon: '🧩' },
    ];

    // Chess.com rating modes
    const chesscomRatingModes = [
        { key: 'chess_bullet', label: 'Bullet', icon: '⚪' },
        { key: 'chess_blitz', label: 'Blitz', icon: '⚡' },
        { key: 'chess_rapid', label: 'Rapid', icon: '🕐' },
        { key: 'chess_daily', label: 'Daily', icon: '📬' },
        { key: 'tactics', label: 'Puzzles', icon: '🧩' },
    ];

    const getLichessRating = (mode) => {
        const perf = user?.perfs?.[mode];
        if (!perf) return null;
        return {
            rating: perf.rating,
            games: perf.games,
            provisional: perf.prov,
        };
    };

    const getChesscomRating = (mode) => {
        const stat = chesscomUser?.stats?.[mode];
        if (!stat?.last?.rating) return null;
        return {
            rating: stat.last.rating,
            games: (stat.record?.win || 0) + (stat.record?.loss || 0) + (stat.record?.draw || 0),
        };
    };

    const handleChesscomConnect = async () => {
        if (!chesscomInput.trim()) return;

        setIsConnecting(true);
        setChesscomError(null);

        try {
            await setChesscomUsername(chesscomInput.trim());
            setChesscomInput('');
        } catch (err) {
            setChesscomError(err.message);
        } finally {
            setIsConnecting(false);
        }
    };


    return (
        <div className="animate-fade-in">
            {/* Connected Accounts Section */}
            <section className="glass-card p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-6">
                    {hasAnyAccount ? 'Your Accounts' : 'Connect Your Accounts'}
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Lichess Card */}
                    {isAuthenticated && user ? (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-indigo-500/30">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700">
                                <img
                                    src="https://lichess.org/assets/logo/lichess-favicon-32.png"
                                    alt="Lichess"
                                    className="w-10 h-10"
                                />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-lg">{user.username}</h4>
                                    <p className="text-xs text-green-400">● Connected</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={`https://lichess.org/@/${user.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                                    >
                                        Profile →
                                    </a>
                                    <button
                                        onClick={logout}
                                        className="text-xs text-red-400 hover:text-red-300"
                                        title="Disconnect"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Ratings Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {lichessRatingModes.map(({ key, label, icon }) => {
                                    const data = getLichessRating(key);
                                    if (!data || data.games === 0) return null;
                                    return (
                                        <div
                                            key={key}
                                            className="p-2 rounded bg-slate-800/50 text-center"
                                        >
                                            <div className="text-xs text-slate-400 mb-1">
                                                {icon} {label}
                                            </div>
                                            <div className="text-lg font-bold text-white">
                                                {data.rating}
                                                {data.provisional && <span className="text-slate-500 text-sm">?</span>}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {data.games} games
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                            <img
                                src="https://lichess.org/assets/logo/lichess-favicon-32.png"
                                alt="Lichess"
                                className="w-10 h-10"
                            />
                            <div className="flex-1">
                                <h4 className="font-medium">Lichess</h4>
                                <p className="text-sm text-slate-400">Connect for live games and full analysis</p>
                            </div>
                            <button className="btn-secondary text-sm" onClick={startLichessAuth}>
                                Connect
                            </button>
                        </div>
                    )}

                    {/* Chess.com Card */}
                    {chesscomUsername && chesscomUser ? (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-green-500/30">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700">
                                <img
                                    src="https://www.chess.com/bundles/web/images/color-icons/handshake.svg"
                                    alt="Chess.com"
                                    className="w-10 h-10"
                                />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-lg">{chesscomUser.username}</h4>
                                    <p className="text-xs text-green-400">● Connected</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={chesscomUser.url || `https://www.chess.com/member/${chesscomUsername}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-slate-400 hover:text-green-400 transition-colors"
                                    >
                                        Profile →
                                    </a>
                                    <button
                                        onClick={clearChesscomAccount}
                                        className="text-xs text-red-400 hover:text-red-300"
                                        title="Disconnect"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Ratings Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {chesscomRatingModes.map(({ key, label, icon }) => {
                                    const data = getChesscomRating(key);
                                    if (!data) return null;
                                    return (
                                        <div
                                            key={key}
                                            className="p-2 rounded bg-slate-800/50 text-center"
                                        >
                                            <div className="text-xs text-slate-400 mb-1">
                                                {icon} {label}
                                            </div>
                                            <div className="text-lg font-bold text-white">
                                                {data.rating}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {data.games} games
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-4 mb-3">
                                <img
                                    src="https://www.chess.com/bundles/web/images/color-icons/handshake.svg"
                                    alt="Chess.com"
                                    className="w-10 h-10"
                                />
                                <div className="flex-1">
                                    <h4 className="font-medium">Chess.com</h4>
                                    <p className="text-sm text-slate-400">Enter your username to connect</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chesscomInput}
                                    onChange={(e) => setChesscomInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleChesscomConnect()}
                                    placeholder="Username..."
                                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                                />
                                <button
                                    className="btn-secondary text-sm"
                                    onClick={handleChesscomConnect}
                                    disabled={isConnecting || !chesscomInput.trim()}
                                >
                                    {isConnecting ? '...' : 'Connect'}
                                </button>
                            </div>
                            {chesscomError && (
                                <p className="text-red-400 text-xs mt-2">{chesscomError}</p>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Live Games Section */}
            {hasAnyAccount && (
                <section className="glass-card p-8 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-semibold">Live Games</h2>
                            <span className={`w-2 h-2 rounded-full ${isPollingLive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
                        </div>
                        <div className="text-sm text-slate-400">
                            {playingGames.length > 0 ? `${playingGames.length} active` : 'No active games'}
                        </div>
                    </div>

                    {selectedLiveGame && liveGameState ? (
                        <div className="flex flex-col items-center">
                            {/* Opponent Info (Top) */}
                            <div className="w-[440px] flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-lg shrink-0">
                                        {getLivePlayerColor() === 'white' ? '♚' : '♔'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-200 truncate">{selectedLiveGame.opponent?.username || 'Opponent'}</span>
                                            <span className="text-xs text-slate-500 shrink-0">({selectedLiveGame.opponent?.rating || '?'})</span>
                                        </div>
                                        <div className="flex gap-0.5 text-xs text-slate-500">
                                            {getCapturedPieces(liveChess)[getLivePlayerColor() === 'white' ? 'w' : 'b'].map((p, i) => (
                                                <span key={i} className="opacity-70">{PIECE_SYMBOLS[p]}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded font-mono font-bold text-xl min-w-[100px] text-center ${!isLiveMyTurn() ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                    {formatLiveTime(getLivePlayerColor() === 'white' ? liveGameState.state?.btime : liveGameState.state?.wtime)}
                                </div>
                            </div>

                            {/* Board Column */}
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 shadow-2xl relative">
                                <div className="max-w-[440px] mx-auto">
                                    <Chessboard
                                        position={liveChess.fen()}
                                        boardWidth={440}
                                        boardOrientation={getLivePlayerColor()}
                                        customDarkSquareStyle={{ backgroundColor: '#B58863' }}
                                        customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
                                        arePiecesDraggable={false}
                                        customPieces={CUSTOM_PIECES}
                                    />
                                </div>
                                {!isLiveMyTurn() && (
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    </div>
                                )}
                            </div>

                            {/* User Info (Bottom) */}
                            <div className="w-[440px] flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-lg shrink-0">
                                        {getLivePlayerColor() === 'white' ? '♔' : '♚'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-200 truncate">
                                                {selectedLiveGame.source === 'chesscom'
                                                    ? chesscomUser?.username || chesscomUsername
                                                    : user?.username || 'You'}
                                            </span>
                                            <span className="text-xs text-slate-500 shrink-0">({selectedLiveGame.rating || '?'})</span>
                                        </div>
                                        <div className="flex gap-0.5 text-xs text-slate-500">
                                            {getCapturedPieces(liveChess)[getLivePlayerColor() === 'white' ? 'b' : 'w'].map((p, i) => (
                                                <span key={i} className="opacity-70">{PIECE_SYMBOLS[p]}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded font-mono font-bold text-xl min-w-[100px] text-center ${isLiveMyTurn() ? 'bg-slate-700 text-white border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                    {formatLiveTime(getLivePlayerColor() === 'white' ? liveGameState.state?.wtime : liveGameState.state?.btime)}
                                </div>
                            </div>

                            {/* Game Switcher below the board if they exist */}
                            {playingGames.length > 1 && (
                                <div className="mt-8 w-full max-w-[440px]">
                                    <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider text-center">Your Other Games</h3>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {playingGames.filter(g => (g.gameId || g.id) !== selectedLiveLiveGameId()).map((game) => (
                                            <button
                                                key={game.gameId || game.id}
                                                onClick={() => setSelectedLiveGame(game)}
                                                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 transition-all flex items-center gap-2"
                                            >
                                                vs <span className="font-medium">{game.opponent?.username || 'Opponent'}</span>
                                                {game.source === 'chesscom' && (
                                                    <img src="https://www.chess.com/bundles/web/images/color-icons/handshake.svg" className="w-3 h-3 opacity-50" alt="Chess.com" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-900/30 rounded-xl p-12 text-center border-2 border-dashed border-slate-800">
                            <div className="text-5xl mb-4 opacity-50">🎮</div>
                            <h3 className="text-xl font-medium text-slate-300 mb-2">No active games right now</h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                Start a game on Lichess and it will appear here automatically for live tracking.
                            </p>
                            <a
                                href="https://lichess.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary text-sm inline-flex items-center gap-2"
                            >
                                Play on Lichess <span>↗</span>
                            </a>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
