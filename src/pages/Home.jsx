import { useAuthStore } from '../stores/authStore';
import { startLichessAuth, streamGame } from '../services/lichess';
import { useEffect, useState, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { CUSTOM_PIECES } from '../components/ChessPieces';

export default function Home() {
    const {
        isAuthenticated, user, token, playingGames, fetchPlayingGames,
        loadProfile,
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
        if (!isAuthenticated || !token) return;

        const pollGames = async () => {
            setIsPollingLive(true);
            await fetchPlayingGames();
            setIsPollingLive(false);
        };

        pollGames();
        const interval = setInterval(pollGames, 5000);

        return () => clearInterval(interval);
    }, [isAuthenticated, token, fetchPlayingGames]);

    useEffect(() => {
        if (playingGames.length > 0 && !selectedLiveGame) {
            setSelectedLiveGame(playingGames[0]);
        } else if (playingGames.length === 0) {
            setSelectedLiveGame(null);
            setLiveGameState(null);
        }
    }, [playingGames, selectedLiveGame]);

    useEffect(() => {
        if (!selectedLiveGame || !token) return;

        if (streamCleanupRef.current) {
            streamCleanupRef.current();
        }

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

        return () => {
            if (streamCleanupRef.current) {
                streamCleanupRef.current();
            }
        };
    }, [selectedLiveGame, token, fetchPlayingGames]);

    const selectedLiveLiveGameId = () => selectedLiveGame?.gameId || selectedLiveGame?.id;

    const formatLiveTime = (ms) => {
        if (!ms) return '--:--';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getLivePlayerColor = () => {
        if (!selectedLiveGame || !user) return 'white';
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

    const hasAnyAccount = isAuthenticated || chesscomUsername;

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
                                <a
                                    href={`https://lichess.org/@/${user.username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                                >
                                    View Profile →
                                </a>
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
            {isAuthenticated && (
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
                        <div className="grid lg:grid-cols-3 gap-8">
                            {/* Board Column */}
                            <div className="lg:col-span-2">
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                                    <div className="max-w-[440px] mx-auto">
                                        <Chessboard
                                            position={liveChess.fen()}
                                            boardWidth={440}
                                            boardOrientation={getLivePlayerColor()}
                                            customDarkSquareStyle={{ backgroundColor: '#4f46e5' }}
                                            customLightSquareStyle={{ backgroundColor: '#e0e7ff' }}
                                            arePiecesDraggable={false}
                                            customPieces={CUSTOM_PIECES}
                                        />
                                    </div>
                                    <div className="flex justify-center mt-4">
                                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isLiveMyTurn() ? 'bg-green-500/20 text-green-400' : 'bg-slate-700/50 text-slate-400'
                                            }`}>
                                            {isLiveMyTurn() ? '🟢 Your turn' : '⏳ Opponent\'s turn'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Info Column */}
                            <div className="space-y-4">
                                {/* Clocks & Players */}
                                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
                                    {/* Opponent */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-lg">
                                                {getLivePlayerColor() === 'white' ? '♚' : '♔'}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-200">{selectedLiveGame.opponent?.username || 'Opponent'}</div>
                                                <div className="text-xs text-slate-500">{selectedLiveGame.opponent?.rating || '?'}</div>
                                            </div>
                                        </div>
                                        <div className="text-2xl font-mono font-bold text-slate-300">
                                            {formatLiveTime(getLivePlayerColor() === 'white' ? liveGameState.state?.btime : liveGameState.state?.wtime)}
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-800 w-full"></div>

                                    {/* You */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-lg">
                                                {getLivePlayerColor() === 'white' ? '♔' : '♚'}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-200">{user.username}</div>
                                                <div className="text-xs text-slate-500">{selectedLiveGame.rating || '?'}</div>
                                            </div>
                                        </div>
                                        <div className={`text-2xl font-mono font-bold ${isLiveMyTurn() ? 'text-green-400' : 'text-slate-300'}`}>
                                            {formatLiveTime(getLivePlayerColor() === 'white' ? liveGameState.state?.wtime : liveGameState.state?.btime)}
                                        </div>
                                    </div>
                                </div>

                                {/* Games Switcher */}
                                {playingGames.length > 1 && (
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                                        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Other Active Games</h3>
                                        <div className="space-y-2">
                                            {playingGames.map((game) => (
                                                <button
                                                    key={game.gameId || game.id}
                                                    onClick={() => setSelectedLiveGame(game)}
                                                    className={`w-full p-2.5 rounded-lg text-left text-sm transition-all ${(game.gameId || game.id) === selectedLiveLiveGameId()
                                                            ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                                                            : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300'
                                                        }`}
                                                >
                                                    vs <span className="font-medium">{game.opponent?.username || 'Opponent'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
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
