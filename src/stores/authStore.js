import { create } from 'zustand';
import {
    getLichessToken,
    saveLichessToken,
    clearLichessToken,
    getLichessProfile,
    getPlayingGames,
} from '../services/lichess';

/**
 * Auth store using Zustand
 * Manages Lichess authentication state
 */
export const useAuthStore = create((set, get) => ({
    // State
    isAuthenticated: !!getLichessToken(),
    token: getLichessToken(),
    user: null,
    playingGames: [],
    isLoading: false,
    error: null,

    // Actions
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
}));
