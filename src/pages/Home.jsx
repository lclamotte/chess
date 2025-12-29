export default function Home() {
    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <section className="text-center py-16">
                <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Master Your Chess Game
                </h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
                    Analyze your games with powerful Stockfish engine, track live matches, and discover insights to improve your play.
                </p>
                <div className="flex gap-4 justify-center">
                    <button className="btn-primary">Get Started</button>
                    <button className="btn-secondary">Learn More</button>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="glass-card p-6">
                    <div className="text-4xl mb-4">🔴</div>
                    <h3 className="text-xl font-semibold mb-2">Live Tracking</h3>
                    <p className="text-slate-400">
                        Watch your Lichess games in real-time with live position updates and time tracking.
                    </p>
                </div>

                <div className="glass-card p-6">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-xl font-semibold mb-2">Game Analysis</h3>
                    <p className="text-slate-400">
                        Upload PGN/FEN or import from your account. Get move-by-move analysis powered by Stockfish.
                    </p>
                </div>

                <div className="glass-card p-6">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold mb-2">Deep Stats</h3>
                    <p className="text-slate-400">
                        Discover patterns in your games: blunder rates, time pressure mistakes, and opening success rates.
                    </p>
                </div>
            </section>

            {/* Quick Stats Preview */}
            <section className="glass-card p-8 mt-12">
                <h2 className="text-2xl font-semibold mb-6">Connect Your Accounts</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                        <img
                            src="https://lichess.org/assets/logo/lichess-favicon-32.png"
                            alt="Lichess"
                            className="w-10 h-10"
                        />
                        <div className="flex-1">
                            <h4 className="font-medium">Lichess</h4>
                            <p className="text-sm text-slate-400">Connect for live games and full analysis</p>
                        </div>
                        <button className="btn-secondary text-sm">Connect</button>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                        <img
                            src="https://www.chess.com/bundles/web/images/color-icons/handshake.svg"
                            alt="Chess.com"
                            className="w-10 h-10"
                        />
                        <div className="flex-1">
                            <h4 className="font-medium">Chess.com</h4>
                            <p className="text-sm text-slate-400">Import games via public API</p>
                        </div>
                        <button className="btn-secondary text-sm">Connect</button>
                    </div>
                </div>
            </section>
        </div>
    );
}
