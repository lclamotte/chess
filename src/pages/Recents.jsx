import { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { useAuthStore } from '../stores/authStore';
import { startLichessAuth, getUserGames } from '../services/lichess';
import { getChesscomRecentGames, normalizeChesscomGame } from '../services/chesscom';
import { PIECE_SVGS } from '../components/ChessPieces';
import { useStockfish } from '../hooks/useStockfish';
import EvalBar from '../components/EvalBar';

export default function Recents() {
    const { isAuthenticated, user, token, chesscomUsername } = useAuthStore();
    const [platform, setPlatform] = useState('lichess'); // 'lichess' or 'chesscom'
    const [games, setGames] = useState([]);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const [error, setError] = useState(null);
    const [boardPosition, setBoardPosition] = useState('start');
    const [lastMoveSquares, setLastMoveSquares] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [variationMoves, setVariationMoves] = useState([]); // UCI moves in the explored variation
    const [inVariation, setInVariation] = useState(false);     // Are we exploring a variation?
    const activeMoveRef = useRef(null);

    // Fetch recent games based on platform
    useEffect(() => {
        const fetchRecentGames = async () => {
            // Need either Lichess auth or Chess.com username
            if (platform === 'lichess' && (!isAuthenticated || !user)) return;
            if (platform === 'chesscom' && !chesscomUsername) return;

            setIsLoading(true);
            setError(null);
            setSelectedGame(null);
            setGames([]);

            try {
                let fetchedGames = [];

                if (platform === 'lichess') {
                    fetchedGames = await getUserGames(user.username, { max: 10 });
                } else {
                    // Chess.com
                    const rawGames = await getChesscomRecentGames(chesscomUsername, 10);
                    fetchedGames = rawGames.map(g => normalizeChesscomGame(g, chesscomUsername));
                }

                setGames(fetchedGames);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecentGames();
    }, [platform, isAuthenticated, user, chesscomUsername]);

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
                    // Get analysis judgment for this move if available
                    const analysis = selectedGame.analysis?.[i];
                    const judgment = analysis?.judgment;

                    positions.push({
                        fen: chess.fen(),
                        move: moveResult,
                        clock: clocks[i] ? clocks[i] : null,
                        lastMove: [moveResult.from, moveResult.to],
                        judgment: judgment?.name || null, // 'Blunder', 'Mistake', 'Inaccuracy', 'Good', 'Brilliant'
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

    // Convert Lichess judgment to chess annotation symbol
    // https://en.wikipedia.org/wiki/Chess_annotation_symbols
    const getAnnotationSymbol = (judgment) => {
        const symbols = {
            'Brilliant': { symbol: '!!', color: 'text-cyan-400' },
            'Good': { symbol: '!', color: 'text-green-400' },
            'Interesting': { symbol: '!?', color: 'text-blue-400' },
            'Dubious': { symbol: '?!', color: 'text-yellow-400' },
            'Mistake': { symbol: '?', color: 'text-orange-400' },
            'Inaccuracy': { symbol: '?!', color: 'text-yellow-400' },
            'Blunder': { symbol: '??', color: 'text-red-400' },
        };
        return symbols[judgment] || null;
    };


    const getPlayerColor = () => {
        if (!selectedGame) return 'white';

        // Use the correct username based on platform
        const currentUsername = platform === 'chesscom' ? chesscomUsername : user?.username;
        if (!currentUsername) return 'white';

        return selectedGame.players?.white?.user?.name?.toLowerCase() === currentUsername.toLowerCase() ? 'white' : 'black';
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

    // Auto-scroll to active move in move list
    useEffect(() => {
        if (activeMoveRef.current) {
            activeMoveRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentMoveIndex]);

    // Stockfish for local analysis fallback
    const {
        isReady,
        evaluation: stockfishEval,
        bestMove: stockfishBestMove,
        analyze: analyzeStockfish,
        stop: stopStockfish
    } = useStockfish();

    // Keyboard navigation
    useEffect(() => {
        if (!selectedGame) return;

        const handleKeyDown = (e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();

                if (e.key === 'ArrowRight' && e.shiftKey) {
                    // Shift+Right: Enter best move variation
                    const bestMoveUci = currentBestMove;
                    if (bestMoveUci) {
                        setVariationMoves(prev => [...prev, bestMoveUci]);
                        setInVariation(true);
                    }
                } else if (e.key === 'ArrowRight') {
                    if (inVariation) {
                        // In variation: continue with next best move (will be computed after position updates)
                        const bestMoveUci = currentBestMove;
                        if (bestMoveUci) {
                            setVariationMoves(prev => [...prev, bestMoveUci]);
                        }
                    } else {
                        goNext();
                    }
                } else if (e.key === 'ArrowLeft' && e.shiftKey) {
                    // Shift+Left: Exit variation entirely, return to branch point
                    if (inVariation) {
                        setVariationMoves([]);
                        setInVariation(false);
                    }
                } else if (e.key === 'ArrowLeft') {
                    if (inVariation && variationMoves.length > 0) {
                        // In variation: go back one move
                        const newMoves = variationMoves.slice(0, -1);
                        setVariationMoves(newMoves);
                        if (newMoves.length === 0) {
                            setInVariation(false);
                        }
                    } else {
                        goPrev();
                    }
                } else if (e.key === 'ArrowUp') {
                    goFirst();
                    setInVariation(false);
                    setVariationMoves([]);
                } else if (e.key === 'ArrowDown') {
                    goLast();
                    setInVariation(false);
                    setVariationMoves([]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedGame, currentMoveIndex, gameData, inVariation, variationMoves, stockfishBestMove]);

    // Base position from the game (without variation)
    const basePosition = useMemo(() => {
        if (!gameData || !gameData.positions) return 'start';
        const pos = gameData.positions[currentMoveIndex + 1];
        return pos?.fen || 'start';
    }, [gameData, currentMoveIndex]);

    // Current position (includes variation if exploring one)
    const currentPosition = useMemo(() => {
        if (!inVariation || variationMoves.length === 0) {
            return basePosition;
        }
        // Apply variation moves to get the current position
        try {
            const chess = new Chess(basePosition);
            for (const uciMove of variationMoves) {
                const from = uciMove.slice(0, 2);
                const to = uciMove.slice(2, 4);
                const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
                chess.move({ from, to, promotion });
            }
            return chess.fen();
        } catch (e) {
            console.error('Error applying variation moves:', e);
            return basePosition;
        }
    }, [basePosition, inVariation, variationMoves]);

    // Get current best move (from Lichess analysis or Stockfish)
    const currentBestMove = useMemo(() => {
        // In variation mode, use Stockfish's best move for the current variation position
        if (inVariation) {
            return stockfishBestMove;
        }

        // Try Lichess analysis first (it stores best move as 'best' field)
        const lichessAnalysis = selectedGame?.analysis;
        if (lichessAnalysis && currentMoveIndex >= 0 && lichessAnalysis[currentMoveIndex]?.best) {
            return lichessAnalysis[currentMoveIndex].best;
        }

        // Fall back to Stockfish
        return stockfishBestMove;
    }, [selectedGame, currentMoveIndex, stockfishBestMove, inVariation]);

    // Handle evaluation data
    const currentEvaluation = useMemo(() => {
        if (!selectedGame) return null;

        // Try to get Lichess analysis if available
        // Lichess data: analysis is an array of eval objects corresponding to moves
        // The first element in gameData.positions is the start position (index -1)
        // Moves start from index 0.
        const lichessAnalysis = selectedGame.analysis;
        if (lichessAnalysis && currentMoveIndex >= 0 && lichessAnalysis[currentMoveIndex]) {
            const entry = lichessAnalysis[currentMoveIndex];
            if (entry.mate) return `${entry.mate > 0 ? '' : '-'}M${Math.abs(entry.mate)}`;
            if (entry.eval !== undefined) return (entry.eval / 100).toFixed(2);
        }

        // Fallback to Stockfish evaluation
        return stockfishEval;
    }, [selectedGame, currentMoveIndex, stockfishEval]);

    // Trigger Stockfish if Lichess analysis is missing
    useEffect(() => {
        if (!selectedGame || currentMoveIndex < -1) return;

        const lichessAnalysis = selectedGame.analysis;
        const hasLichessEval = lichessAnalysis && currentMoveIndex >= 0 && lichessAnalysis[currentMoveIndex];

        if (!hasLichessEval && isReady) {
            // Debounce analysis to prevent flooding Stockfish during rapid navigation
            const timer = setTimeout(() => {
                analyzeStockfish(currentPosition, 16);
            }, 250);

            return () => {
                clearTimeout(timer);
                stopStockfish();
            };
        } else {
            stopStockfish();
        }
    }, [currentPosition, selectedGame, currentMoveIndex, isReady, analyzeStockfish, stopStockfish]);

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

        // Convert square name to board coordinates (0-7 for both file and rank)
        const squareToCoords = (sq) => {
            const file = sq.charCodeAt(0) - 97; // a=0, h=7
            const rank = parseInt(sq[1]) - 1;   // 1=0, 8=7
            // Adjust for orientation
            if (orientation === 'white') {
                return { x: file, y: 7 - rank };
            } else {
                return { x: 7 - file, y: rank };
            }
        };

        // Parse best move UCI to get arrow coordinates
        const getArrowCoords = () => {
            if (!currentBestMove || currentBestMove.length < 4) return null;
            const from = currentBestMove.slice(0, 2);
            const to = currentBestMove.slice(2, 4);
            const fromCoords = squareToCoords(from);
            const toCoords = squareToCoords(to);
            return { from: fromCoords, to: toCoords };
        };

        const arrowCoords = getArrowCoords();

        return (
            <div className="relative">
                {/* Board grid */}
                <div className="grid grid-cols-8 border-2 border-slate-700 bg-slate-800">
                    {displayBoard.map((row, rankIdx) => (
                        row.map((square, fileIdx) => {
                            const isLight = (rankIdx + fileIdx) % 2 === 0;
                            const rank = orientation === 'white' ? 8 - rankIdx : rankIdx + 1;
                            const file = orientation === 'white'
                                ? String.fromCharCode(97 + fileIdx)
                                : String.fromCharCode(104 - fileIdx);
                            const squareName = `${file}${rank}`;

                            // Highlight variation moves or last move from actual game
                            const isLastMove = inVariation
                                ? false  // In variation, we don't highlight (arrow shows instead)
                                : currentLastMove && (currentLastMove[0] === squareName || currentLastMove[1] === squareName);

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

                {/* Best move arrow overlay */}
                {arrowCoords && (
                    <svg
                        className="absolute inset-0 pointer-events-none"
                        viewBox="0 0 8 8"
                        preserveAspectRatio="xMidYMid slice"
                    >
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="3"
                                markerHeight="3"
                                refX="2"
                                refY="1.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 3 1.5, 0 3" fill="rgba(34, 197, 94, 0.8)" />
                            </marker>
                        </defs>
                        <line
                            x1={arrowCoords.from.x + 0.5}
                            y1={arrowCoords.from.y + 0.5}
                            x2={arrowCoords.to.x + 0.5}
                            y2={arrowCoords.to.y + 0.5}
                            stroke="rgba(34, 197, 94, 0.8)"
                            strokeWidth="0.2"
                            markerEnd="url(#arrowhead)"
                        />
                    </svg>
                )}

                {/* Variation mode indicator */}
                {inVariation && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/90 text-xs font-semibold rounded text-slate-900">
                        Exploring variation ({variationMoves.length} move{variationMoves.length !== 1 ? 's' : ''})
                    </div>
                )}
            </div>
        );
    };

    const hasActiveAccount = (platform === 'lichess' && isAuthenticated) || (platform === 'chesscom' && chesscomUsername);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Recent Games</h1>
                    <p className="text-slate-400">Review your latest session with full game replay</p>
                </div>

                {/* Platform Toggle */}
                <div className="flex bg-slate-800/50 rounded-lg p-1">
                    <button
                        onClick={() => setPlatform('lichess')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${platform === 'lichess'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <img src="https://lichess.org/assets/logo/lichess-favicon-32.png" alt="" className="w-4 h-4 inline mr-2" />
                        Lichess
                    </button>
                    <button
                        onClick={() => setPlatform('chesscom')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${platform === 'chesscom'
                            ? 'bg-green-600 text-white'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <img src="https://www.chess.com/bundles/web/images/color-icons/handshake.svg" alt="" className="w-4 h-4 inline mr-2" />
                        Chess.com
                    </button>
                </div>
            </div>

            {!hasActiveAccount ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-6">🔐</div>
                    <h2 className="text-2xl font-semibold mb-4">
                        Connect to {platform === 'lichess' ? 'Lichess' : 'Chess.com'}
                    </h2>
                    <p className="text-slate-400 mb-6 max-w-md mx-auto">
                        {platform === 'lichess'
                            ? 'Authenticate with your Lichess account to view your recent games.'
                            : 'Connect your Chess.com username on the Home page to view your recent games.'}
                    </p>
                    {platform === 'lichess' ? (
                        <button className="btn-primary" onClick={startLichessAuth}>
                            Connect Lichess Account
                        </button>
                    ) : (
                        <a href="/" className="btn-primary inline-block">
                            Go to Home Page
                        </a>
                    )}
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
                                        onClick={() => { setSelectedGame(game); setCurrentMoveIndex(-1); setInVariation(false); setVariationMoves([]); }}
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
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                            <span>{isWhite ? '♔ White' : '♚ Black'} • {game.speed || 'Standard'}</span>
                                            <span>{new Date(game.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                        {game.opening?.name && (
                                            <div className="text-xs text-slate-400 truncate">
                                                {game.opening.name.split(':')[0]}
                                            </div>
                                        )}
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
                                        <div className="flex gap-4 max-w-[540px] mx-auto items-stretch">
                                            <div className="flex-1">
                                                {renderBoard()}
                                            </div>
                                            <EvalBar evaluation={currentEvaluation} />
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

                                            {/* Evaluation Number */}
                                            {currentEvaluation && (
                                                <span className={`ml-2 px-3 py-2 font-mono font-bold text-sm min-w-[60px] text-center ${currentEvaluation.toString().startsWith('-') || currentEvaluation.toString().startsWith('-M')
                                                    ? 'text-slate-900 bg-slate-200 rounded'
                                                    : 'text-white bg-slate-700 rounded'
                                                    }`}>
                                                    {parseFloat(currentEvaluation) > 0 && !currentEvaluation.toString().startsWith('M')
                                                        ? `+${currentEvaluation}`
                                                        : currentEvaluation}
                                                </span>
                                            )}
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
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-medium">Moves</h3>
                                            <button
                                                onClick={() => {
                                                    // Build PGN up to current position
                                                    const moves = gameData?.positions.slice(1, currentMoveIndex + 2).map(p => p.move?.san).filter(Boolean) || [];
                                                    const pgn = moves.reduce((acc, move, i) => {
                                                        if (i % 2 === 0) {
                                                            return acc + `${Math.floor(i / 2) + 1}. ${move} `;
                                                        }
                                                        return acc + `${move} `;
                                                    }, '').trim();
                                                    navigator.clipboard.writeText(pgn).then(() => {
                                                        setCopySuccess(true);
                                                        setTimeout(() => setCopySuccess(false), 2000);
                                                    });
                                                }}
                                                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                                                title="Copy PGN up to current position"
                                            >
                                                {copySuccess ? '✓ Copied' : '📋 PGN'}
                                            </button>
                                        </div>
                                        <div className="text-sm font-mono space-y-1 max-h-48 overflow-y-auto">
                                            {gameData?.positions.slice(1).reduce((acc, pos, i) => {
                                                if (i % 2 === 0) {
                                                    acc.push([pos]);
                                                } else {
                                                    acc[acc.length - 1].push(pos);
                                                }
                                                return acc;
                                            }, []).map((pair, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <span className="text-slate-500 w-6">{i + 1}.</span>
                                                    <button
                                                        ref={currentMoveIndex === i * 2 ? activeMoveRef : null}
                                                        onClick={() => goToMove(i * 2)}
                                                        className={`min-w-[50px] text-left hover:text-indigo-400 ${currentMoveIndex === i * 2 ? 'text-indigo-400 font-bold' : ''}`}
                                                    >
                                                        {pair[0]?.move?.san}
                                                        {pair[0]?.judgment && (
                                                            <span className={`ml-0.5 ${getAnnotationSymbol(pair[0].judgment)?.color || ''}`}>
                                                                {getAnnotationSymbol(pair[0].judgment)?.symbol}
                                                            </span>
                                                        )}
                                                    </button>
                                                    {pair[1] && (
                                                        <button
                                                            ref={currentMoveIndex === i * 2 + 1 ? activeMoveRef : null}
                                                            onClick={() => goToMove(i * 2 + 1)}
                                                            className={`min-w-[50px] text-left hover:text-indigo-400 ${currentMoveIndex === i * 2 + 1 ? 'text-indigo-400 font-bold' : ''}`}
                                                        >
                                                            {pair[1]?.move?.san}
                                                            {pair[1]?.judgment && (
                                                                <span className={`ml-0.5 ${getAnnotationSymbol(pair[1].judgment)?.color || ''}`}>
                                                                    {getAnnotationSymbol(pair[1].judgment)?.symbol}
                                                                </span>
                                                            )}
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
                                        <a
                                            href={selectedGame.url || (platform === 'lichess'
                                                ? `https://lichess.org/${selectedGame.id}`
                                                : `https://www.chess.com/game/live/${selectedGame.id}`)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            View on {platform === 'lichess' ? 'Lichess' : 'Chess.com'} →
                                        </a>
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
