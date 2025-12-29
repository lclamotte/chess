import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useStockfish } from '../hooks/useStockfish';
import { CUSTOM_PIECES } from '../components/ChessPieces';

export default function Analysis() {
    const [game, setGame] = useState(new Chess());
    const [pgn, setPgn] = useState('');
    const [fen, setFen] = useState('');
    const [moveHistory, setMoveHistory] = useState([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

    const {
        isReady,
        isAnalyzing,
        evaluation,
        bestMove,
        depth,
        principalVariation,
        analyze,
        stop
    } = useStockfish();

    // Format evaluation for display
    const formatEvaluation = (eval_) => {
        if (!eval_) return null;
        if (eval_.startsWith('M')) return eval_;
        const num = parseFloat(eval_);
        return num >= 0 ? `+${eval_}` : eval_;
    };

    const onDrop = useCallback((sourceSquare, targetSquare) => {
        const gameCopy = new Chess(game.fen());
        try {
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q',
            });
            if (move) {
                setGame(gameCopy);
                setMoveHistory(gameCopy.history({ verbose: true }));
                setCurrentMoveIndex(gameCopy.history().length - 1);
                return true;
            }
        } catch {
            return false;
        }
        return false;
    }, [game]);

    const loadPgn = () => {
        if (!pgn.trim()) return;
        const newGame = new Chess();
        try {
            newGame.loadPgn(pgn);
            setGame(newGame);
            setMoveHistory(newGame.history({ verbose: true }));
            setCurrentMoveIndex(newGame.history().length - 1);
        } catch (e) {
            alert('Invalid PGN format');
        }
    };

    const loadFen = () => {
        if (!fen.trim()) return;
        try {
            const newGame = new Chess(fen);
            setGame(newGame);
            setMoveHistory([]);
            setCurrentMoveIndex(-1);
        } catch (e) {
            alert('Invalid FEN format');
        }
    };

    const resetBoard = () => {
        stop();
        setGame(new Chess());
        setMoveHistory([]);
        setCurrentMoveIndex(-1);
    };

    const analyzePosition = () => {
        if (!isReady) {
            alert('Engine is still loading...');
            return;
        }
        analyze(game.fen(), 20);
    };

    const undoMove = () => {
        const gameCopy = new Chess(game.fen());
        gameCopy.undo();
        setGame(gameCopy);
        setMoveHistory(gameCopy.history({ verbose: true }));
        setCurrentMoveIndex(gameCopy.history().length - 1);
    };

    const formattedEval = formatEvaluation(evaluation);

    return (
        <div className="animate-fade-in">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Game Analysis</h1>
                    <p className="text-slate-400">Analyze positions with Stockfish engine</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                    <span className="text-sm text-slate-400">
                        {isReady ? 'Engine Ready' : 'Loading Engine...'}
                    </span>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Board Section */}
                <div className="lg:col-span-2">
                    <div className="glass-card p-6">
                        <div className="max-w-[500px] mx-auto">
                            <Chessboard
                                position={game.fen()}
                                onPieceDrop={onDrop}
                                boardWidth={480}
                                customDarkSquareStyle={{ backgroundColor: '#4f46e5' }}
                                customLightSquareStyle={{ backgroundColor: '#e0e7ff' }}
                                customPieces={CUSTOM_PIECES}
                            />
                        </div>
                        <div className="flex gap-3 justify-center mt-6">
                            <button
                                onClick={undoMove}
                                className="btn-secondary text-sm"
                                disabled={game.history().length === 0}
                            >
                                ← Undo
                            </button>
                            <button onClick={resetBoard} className="btn-secondary text-sm">
                                Reset
                            </button>
                            <button
                                onClick={isAnalyzing ? stop : analyzePosition}
                                className={`text-sm ${isAnalyzing ? 'btn-secondary' : 'btn-primary'}`}
                                disabled={!isReady}
                            >
                                {isAnalyzing ? '⏹ Stop' : '🔍 Analyze'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Analysis Panel */}
                <div className="space-y-4">
                    {/* Evaluation */}
                    <div className="glass-card p-4">
                        <h3 className="font-medium mb-3 flex items-center justify-between">
                            Engine Evaluation
                            {isAnalyzing && <span className="text-xs text-indigo-400">Depth: {depth}</span>}
                        </h3>
                        {formattedEval ? (
                            <div className="text-center">
                                <div className={`text-4xl font-bold mb-2 ${formattedEval.startsWith('+') ? 'text-green-400' :
                                    formattedEval.startsWith('-') ? 'text-red-400' :
                                        formattedEval.startsWith('M') ? 'text-purple-400' : 'text-yellow-400'
                                    }`}>
                                    {formattedEval}
                                </div>
                                {bestMove && (
                                    <div className="text-sm text-slate-400">
                                        Best move: <span className="text-white font-mono">{bestMove}</span>
                                    </div>
                                )}
                                {principalVariation.length > 0 && (
                                    <div className="mt-2 text-xs text-slate-500 font-mono">
                                        PV: {principalVariation.join(' ')}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-4">
                                {isReady ? 'Click "Analyze" to evaluate position' : 'Loading Stockfish...'}
                            </div>
                        )}
                    </div>

                    {/* Move History */}
                    {moveHistory.length > 0 && (
                        <div className="glass-card p-4">
                            <h3 className="font-medium mb-3">Move History</h3>
                            <div className="text-sm font-mono space-y-1 max-h-32 overflow-y-auto">
                                {moveHistory.reduce((acc, move, i) => {
                                    if (i % 2 === 0) {
                                        acc.push([move]);
                                    } else {
                                        acc[acc.length - 1].push(move);
                                    }
                                    return acc;
                                }, []).map((pair, i) => (
                                    <div key={i} className="flex gap-4">
                                        <span className="text-slate-500 w-6">{i + 1}.</span>
                                        <span className="w-12">{pair[0]?.san}</span>
                                        <span className="w-12 text-slate-400">{pair[1]?.san || ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PGN Input */}
                    <div className="glass-card p-4">
                        <h3 className="font-medium mb-3">Load PGN</h3>
                        <textarea
                            value={pgn}
                            onChange={(e) => setPgn(e.target.value)}
                            placeholder="Paste PGN notation here..."
                            className="w-full h-24 bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm font-mono resize-none focus:border-indigo-500 focus:outline-none"
                        />
                        <button onClick={loadPgn} className="btn-secondary w-full mt-2 text-sm">
                            Load PGN
                        </button>
                    </div>

                    {/* FEN Input */}
                    <div className="glass-card p-4">
                        <h3 className="font-medium mb-3">Load FEN</h3>
                        <input
                            type="text"
                            value={fen}
                            onChange={(e) => setFen(e.target.value)}
                            placeholder="Paste FEN string..."
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                        />
                        <button onClick={loadFen} className="btn-secondary w-full mt-2 text-sm">
                            Load FEN
                        </button>
                    </div>

                    {/* Current FEN */}
                    <div className="glass-card p-4">
                        <h3 className="font-medium mb-3">Current Position</h3>
                        <code className="text-xs text-slate-400 break-all block bg-slate-800/50 p-2 rounded">
                            {game.fen()}
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
}
