import { create } from 'zustand';
import { getUserGames } from '../services/lichess';
import { getChesscomRecentGames, normalizeChesscomGame } from '../services/chesscom';

/**
 * Games store using Zustand
 * Caches recent games for both Lichess and Chess.com
 */
export const useGamesStore = create((set, get) => ({
    // Cached games
    lichessGames: [],
    chesscomGames: [],

    // Loading states
    lichessLoading: false,
    chesscomLoading: false,

    // Track if initial fetch has been done
    lichessFetched: false,
    chesscomFetched: false,

    // Errors
    lichessError: null,
    chesscomError: null,

    // Fetch Lichess games
    fetchLichessGames: async (username, force = false) => {
        if (!username) return;

        // Skip if already fetched and not forcing refresh
        if (get().lichessFetched && !force) return;

        set({ lichessLoading: true, lichessError: null });

        try {
            const games = await getUserGames(username, { max: 10 });
            set({
                lichessGames: games,
                lichessLoading: false,
                lichessFetched: true,
            });
        } catch (err) {
            set({
                lichessError: err.message,
                lichessLoading: false,
                lichessFetched: true,
            });
        }
    },

    // Fetch Chess.com games
    fetchChesscomGames: async (username, force = false) => {
        if (!username) return;

        // Skip if already fetched and not forcing refresh
        if (get().chesscomFetched && !force) return;

        set({ chesscomLoading: true, chesscomError: null });

        try {
            const rawGames = await getChesscomRecentGames(username, 10);
            const games = rawGames.map(g => normalizeChesscomGame(g, username));
            set({
                chesscomGames: games,
                chesscomLoading: false,
                chesscomFetched: true,
            });
        } catch (err) {
            set({
                chesscomError: err.message,
                chesscomLoading: false,
                chesscomFetched: true,
            });
        }
    },

    // Clear Lichess cache (on disconnect)
    clearLichessGames: () => {
        set({
            lichessGames: [],
            lichessFetched: false,
            lichessError: null,
        });
    },

    // Clear Chess.com cache (on disconnect)
    clearChesscomGames: () => {
        set({
            chesscomGames: [],
            chesscomFetched: false,
            chesscomError: null,
        });
    },

    // Refresh all games
    refreshAll: async (lichessUsername, chesscomUsername) => {
        const promises = [];
        if (lichessUsername) {
            promises.push(get().fetchLichessGames(lichessUsername, true));
        }
        if (chesscomUsername) {
            promises.push(get().fetchChesscomGames(chesscomUsername, true));
        }
        await Promise.all(promises);
    },
}));
