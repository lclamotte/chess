import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useEffect, useState, useRef } from 'react';

// Board theme definitions (shared with Recents page via localStorage)
const BOARD_THEMES = {
    default: { name: 'Default', light: '#e0e7ff', dark: '#4f46e5' },
    walnut: { name: 'Walnut', light: '#d4a76a', dark: '#8b5a2b' },
    green: { name: 'Green', light: '#eeeed2', dark: '#769656' },
    blue: { name: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
    brown: { name: 'Brown', light: '#f0d9b5', dark: '#b58863' },
    purple: { name: 'Purple', light: '#e8d0ff', dark: '#7c4dff' },
    gray: { name: 'Gray', light: '#e8e8e8', dark: '#7d7d7d' },
};

function Navbar() {
    const { isAuthenticated, user, chesscomUsername, loadProfile } = useAuthStore();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [boardTheme, setBoardTheme] = useState(() => {
        return localStorage.getItem('chess-board-theme') || 'default';
    });
    const settingsRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated && !user) {
            loadProfile();
        }
    }, [isAuthenticated, user, loadProfile]);

    // Persist theme to localStorage
    useEffect(() => {
        localStorage.setItem('chess-board-theme', boardTheme);
        // Dispatch event so other components can react to theme changes
        window.dispatchEvent(new Event('theme-change'));
    }, [boardTheme]);

    // Close settings dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                setSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navItems = [
        { to: '/', label: 'Home', icon: '♟' },
        { to: '/recents', label: 'Recents', icon: '🕐' },
        { to: '/stats', label: 'Stats', icon: '📊' },
    ];

    return (
        <nav className="glass sticky top-0 z-50 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">♚</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        ChessAnalyzer
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {navItems.map(({ to, label, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${isActive
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`
                            }
                        >
                            <span>{icon}</span>
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    {(isAuthenticated || chesscomUsername) && (
                        <div className="flex items-center gap-4 border-r border-slate-700 pr-4">
                            {isAuthenticated && user && (
                                <div className="flex items-center gap-2 group">
                                    <img
                                        src="https://lichess.org/assets/logo/lichess-favicon-32.png"
                                        alt="Lichess"
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-slate-300 font-medium">{user.username}</span>
                                </div>
                            )}
                            {chesscomUsername && (
                                <div className="flex items-center gap-2 group">
                                    <img
                                        src="https://www.chess.com/bundles/web/images/color-icons/handshake.svg"
                                        alt="Chess.com"
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-slate-300 font-medium">{chesscomUsername}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Settings Dropdown */}
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setSettingsOpen(!settingsOpen)}
                            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                            title="Settings"
                        >
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>

                        {settingsOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                                <div className="p-3 border-b border-slate-700">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Board Theme</span>
                                </div>
                                <div className="p-2">
                                    {Object.entries(BOARD_THEMES).map(([key, theme]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setBoardTheme(key);
                                                setSettingsOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                                                boardTheme === key
                                                    ? 'bg-indigo-500/20 text-indigo-300'
                                                    : 'hover:bg-slate-700/50 text-slate-300'
                                            }`}
                                        >
                                            <div className="flex">
                                                <div
                                                    className="w-4 h-4 rounded-l-sm"
                                                    style={{ backgroundColor: theme.light }}
                                                />
                                                <div
                                                    className="w-4 h-4 rounded-r-sm"
                                                    style={{ backgroundColor: theme.dark }}
                                                />
                                            </div>
                                            <span>{theme.name}</span>
                                            {boardTheme === key && (
                                                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
                {children}
            </main>
            <footer className="text-center text-slate-500 text-sm py-4 border-t border-slate-800">
                ChessAnalyzer &copy; {new Date().getFullYear()} — Powered by Stockfish
            </footer>
        </div>
    );
}
