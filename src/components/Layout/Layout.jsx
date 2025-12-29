import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { startLichessAuth } from '../../services/lichess';
import { useEffect } from 'react';

function Navbar() {
    const { isAuthenticated, user, isLoading, logout, loadProfile } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated && !user) {
            loadProfile();
        }
    }, [isAuthenticated, user, loadProfile]);

    const navItems = [
        { to: '/', label: 'Home', icon: '♟' },
        { to: '/live', label: 'Live', icon: '🔴' },
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

                <div className="flex items-center gap-3">
                    {isAuthenticated && user && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-slate-300">{user.username}</span>
                        </div>
                    )}
                    <button
                        onClick={handleAuth}
                        className={isAuthenticated ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Loading...' : isAuthenticated ? 'Logout' : 'Connect Lichess'}
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
