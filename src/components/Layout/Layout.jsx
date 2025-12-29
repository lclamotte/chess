import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { startLichessAuth } from '../../services/lichess';
import { useEffect } from 'react';

function Navbar() {
    const { isAuthenticated, user, chesscomUsername, isLoading, logout, loadProfile } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated && !user) {
            loadProfile();
        }
    }, [isAuthenticated, user, loadProfile]);

    const navItems = [
        { to: '/', label: 'Home', icon: '♟' },
        { to: '/recents', label: 'Recents', icon: '🕐' },
        { to: '/analysis', label: 'Analysis', icon: '🔍' },
        { to: '/stats', label: 'Stats', icon: '📊' },
    ];

    const handleAuth = () => {
        if (isAuthenticated) {
            logout();
        } else {
            startLichessAuth();
        }
    };

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

                    <button
                        onClick={handleAuth}
                        className={isAuthenticated ? 'btn-secondary text-sm px-4' : 'btn-primary text-sm px-6'}
                        disabled={isLoading}
                    >
                        {isLoading ? '...' : isAuthenticated ? 'Logout' : 'Connect Lichess'}
                    </button>
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
