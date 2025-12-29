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
} from '../services/chesscom';

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
        if (!token) return [];

        try {
            const data = await getPlayingGames(token);
            set({ playingGames: data.nowPlaying || [] });
            return data.nowPlaying || [];
        } catch (err) {
            console.error('Failed to fetch playing games:', err);
            return [];
        }
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
        set({
            chesscomUsername: null,
            chesscomUser: null,
        });
    },
}));
