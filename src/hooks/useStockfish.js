import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to interface with Stockfish chess engine via Web Worker
 * The stockfish.js file is designed to run directly as a worker
 * @returns {Object} { isReady, evaluation, bestMove, depth, analyze, stop }
 */
export function useStockfish() {
    const [isReady, setIsReady] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [evaluation, setEvaluation] = useState(null);
    const [bestMove, setBestMove] = useState(null);
    const [depth, setDepth] = useState(0);
    const [principalVariation, setPrincipalVariation] = useState([]);

    const workerRef = useRef(null);
    const currentFenRef = useRef(null); // Track current FEN to determine side to move

    useEffect(() => {
        // Create worker directly from stockfish.js
        // The stockfish npm package's js file is designed to run as a worker
        workerRef.current = new Worker('/stockfish.js');

        workerRef.current.onmessage = (e) => {
            const output = e.data;

            // Handle UCI responses
            if (typeof output === 'string') {
                parseUciOutput(output);
            }
        };

        workerRef.current.onerror = (e) => {
            console.error('Stockfish worker error:', e);
        };

        // Initialize UCI
        workerRef.current.postMessage('uci');

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    // Helper to determine if it's Black's turn from FEN
    const isBlackToMove = useCallback(() => {
        if (!currentFenRef.current) return false;
        const parts = currentFenRef.current.split(' ');
        return parts[1] === 'b';
    }, []);

    const parseUciOutput = useCallback((output) => {
        // Handle "uciok" - engine is ready
        if (output === 'uciok') {
            workerRef.current?.postMessage('isready');
        }

        // Handle "readyok" - engine is ready for commands
        if (output === 'readyok') {
            setIsReady(true);
        }

        // Parse "info" lines for evaluation and depth
        if (output.startsWith('info')) {
            const depthMatch = output.match(/depth (\d+)/);
            const scoreMatch = output.match(/score (cp|mate) (-?\d+)/);
            const pvMatch = output.match(/pv (.+)/);

            if (depthMatch) {
                setDepth(parseInt(depthMatch[1]));
            }

            if (scoreMatch) {
                const [, type, value] = scoreMatch;
                let evalValue = parseInt(value);

                // Stockfish reports from side-to-move perspective
                // We always want evaluation from White's perspective
                if (isBlackToMove()) {
                    evalValue = -evalValue;
                }

                if (type === 'cp') {
                    // Centipawns to pawns
                    setEvaluation((evalValue / 100).toFixed(2));
                } else if (type === 'mate') {
                    // For mate, also flip the sign
                    setEvaluation(`M${evalValue}`);
                }
            }

            if (pvMatch) {
                const moves = pvMatch[1].split(' ').slice(0, 5);
                setPrincipalVariation(moves);
            }
        }

        // Parse "bestmove" for final result
        if (output.startsWith('bestmove')) {
            const match = output.match(/bestmove (\S+)/);
            if (match) {
                setBestMove(match[1]);
                setIsAnalyzing(false);
            }
        }
    }, [isBlackToMove]);

    const sendCommand = useCallback((command) => {
        if (workerRef.current) {
            workerRef.current.postMessage(command);
        }
    }, []);

    /**
     * Analyze a position
     * @param {string} fen - FEN string of position to analyze
     * @param {number} [targetDepth=20] - Depth to search
     */
    const analyze = useCallback((fen, targetDepth = 20) => {
        currentFenRef.current = fen; // Store the FEN to determine side to move
        setIsAnalyzing(true);
        setBestMove(null);
        setEvaluation(null);
        setDepth(0);
        setPrincipalVariation([]);

        // Don't send ucinewgame on every move for analysis, it's too heavy
        // sendCommand('ucinewgame');
        sendCommand(`position fen ${fen}`);
        sendCommand(`go depth ${targetDepth}`);
    }, [sendCommand]);

    const stop = useCallback(() => {
        sendCommand('stop');
        setIsAnalyzing(false);
    }, [sendCommand]);

    return {
        isReady,
        isAnalyzing,
        evaluation,
        bestMove,
        depth,
        principalVariation,
        analyze,
        stop,
    };
}

