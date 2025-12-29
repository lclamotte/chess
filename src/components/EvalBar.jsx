import React, { useMemo } from 'react';

/**
 * Vertical Evaluation Bar component
 * @param {string} evaluation - Evaluation string from Stockfish (e.g., "+0.5", "-1.2", "M3", "-M1")
 */
export default function EvalBar({ evaluation }) {
    const whitePercentage = useMemo(() => {
        if (!evaluation) return 50;

        // Handle Mate
        if (evaluation.includes('M')) {
            return evaluation.startsWith('-') ? 0 : 100;
        }

        const score = parseFloat(evaluation);
        if (isNaN(score)) return 50;

        // Advantageous mapping using a sigmoid-like curve to make the bar more responsive
        // around 0.0 and less sensitive to extreme polarizations.
        // Using a coefficient of 1.0 for better visual responsiveness
        // A +1.0 advantage will show as ~73% white, +2.0 as ~88%
        const p = 50 + (2 / (1 + Math.exp(-1.0 * score)) - 1) * 50;

        // Clamp between 5% and 95% so some of both colors are always visible unless it's mate
        return Math.max(5, Math.min(95, p));
    }, [evaluation]);

    return (
        <div className="w-6 bg-slate-800 rounded-full overflow-hidden border border-slate-700 flex flex-col shadow-inner">
            {/* Black Area (top) */}
            <div
                className="bg-slate-900 transition-all duration-700 ease-out relative group"
                style={{ flex: 100 - whitePercentage }}
            >
                <div className="absolute bottom-2 left-0 right-0 text-[10px] font-bold text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {evaluation}
                </div>
            </div>

            {/* White Area (bottom) */}
            <div
                className="bg-white transition-all duration-700 ease-out relative group"
                style={{ flex: whitePercentage }}
            >
                <div className="absolute top-2 left-0 right-0 text-[10px] font-bold text-slate-800 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {evaluation}
                </div>
            </div>
        </div>
    );
}
