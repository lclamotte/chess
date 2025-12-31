import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleLichessCallback } from '../services/lichess';
import { useAuthStore } from '../stores/authStore';

/**
 * OAuth Callback handler page
 * Receives the authorization code from Lichess and exchanges it for a token
 */
export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const setToken = useAuthStore((state) => state.setToken);

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            navigate('/?error=auth_failed');
            return;
        }

        if (code && state) {
            handleLichessCallback(code, state)
                .then((token) => {
                    setToken(token);
                    navigate('/');
                })
                .catch((err) => {
                    console.error('Token exchange failed:', err);
                    navigate('/?error=token_exchange_failed');
                });
        } else {
            navigate('/');
        }
    }, [searchParams, navigate, setToken]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="glass-card p-12 text-center animate-fade-in">
                <div className="text-6xl mb-6 animate-pulse">🔐</div>
                <h2 className="text-2xl font-semibold mb-4">Authenticating...</h2>
                <p className="text-slate-400">Please wait while we complete the login process.</p>
            </div>
        </div>
    );
}
