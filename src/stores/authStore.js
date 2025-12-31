import { create } from 'zustand';
import {
    getLichessToken,
    saveLichessToken,
    clearLichessToken,
    getLichessProfile,
    getPlayingGames,
} from '../services/lichess';
import {
    getChesscomUsername,
    saveChesscomUsername,
    clearChesscomUsername,
    getChesscomProfile,
    getChesscomStats,
    getChesscomCurrentGames,
} from '../services/chesscom';
import { useGamesStore } from './gamesStore';

/**
 * Auth store using Zustand
 * Manages Lichess and Chess.com authentication state
 */
export const useAuthStore = create((set, get) => ({
    // Lichess State
    isAuthenticated: !!getLichessToken(),
    token: getLichessToken(),
    user: null,
    playingGames: [],

    // Chess.com State
    chesscomUsername: getChesscomUsername(),
    chesscomUser: null,

    // Shared State
    isLoading: false,
    error: null,

    // Lichess Actions
    setToken: async (token) => {
        saveLichessToken(token);
        set({ token, isAuthenticated: true, isLoading: true });

        try {
            const user = await getLichessProfile(token);
            set({ user, isLoading: false });
        } catch (err) {
            set({ error: err.message, isLoading: false });
        }
    },

    logout: () => {
        clearLichessToken();
        useGamesStore.getState().clearLichessGames();
        set({
            isAuthenticated: false,
            token: null,
            user: null,
            playingGames: [],
            error: null,
        });
    },

    loadProfile: async () => {
        const token = get().token;
        if (!token) return;

        set({ isLoading: true });
        try {
            const user = await getLichessProfile(token);
            set({ user, isLoading: false });
        } catch (err) {
            // Token might be expired
            if (err.message.includes('401') || err.message.includes('Failed')) {
                get().logout();
            }
            set({ error: err.message, isLoading: false });
        }
    },

    fetchPlayingGames: async () => {
        const token = get().token;
        const chesscomUsername = get().chesscomUsername;

        let lichessGames = [];
        let chesscomGames = [];

        try {
            if (token) {
                const data = await getPlayingGames(token);
                lichessGames = data.nowPlaying || [];
            }
        } catch (err) {
            console.error('Failed to fetch Lichess games:', err);
        }

        try {
            if (chesscomUsername) {
                chesscomGames = await getChesscomCurrentGames(chesscomUsername);
            }
        } catch (err) {
            console.error('Failed to fetch Chess.com games:', err);
        }

        const allGames = [...lichessGames, ...chesscomGames];

        // Sort: Lichess real-time games first, then by recency
        allGames.sort((a, b) => {
            if (a.source !== b.source) {
                return a.source === 'lichess' ? -1 : 1;
            }
            return 0; // Keep relative order otherwise
        });

        set({ playingGames: allGames });
        return allGames;
    },

    // Chess.com Actions
    setChesscomUsername: async (username) => {
        if (!username?.trim()) return;

        set({ isLoading: true, error: null });

        try {
            // Validate username exists and fetch stats
            const [profile, stats] = await Promise.all([
                getChesscomProfile(username),
                getChesscomStats(username),
            ]);

            saveChesscomUsername(username);
            set({
                chesscomUsername: username,
                chesscomUser: { ...profile, stats },
                isLoading: false,
            });
        } catch (err) {
            set({ error: err.message, isLoading: false });
            throw err;
        }
    },

    loadChesscomProfile: async () => {
        const username = get().chesscomUsername;
        if (!username) return;

        set({ isLoading: true });
        try {
            const [profile, stats] = await Promise.all([
                getChesscomProfile(username),
                getChesscomStats(username),
            ]);
            set({
                chesscomUser: { ...profile, stats },
                isLoading: false,
            });
        } catch (err) {
            // Username might be invalid now
            if (err.message.includes('not found')) {
                get().clearChesscomAccount();
            }
            set({ error: err.message, isLoading: false });
        }
    },

    clearChesscomAccount: () => {
        clearChesscomUsername();
        useGamesStore.getState().clearChesscomGames();
        set({
            chesscomUsername: null,
            chesscomUser: null,
        });
    },
}));
