/**
 * Lichess OAuth 2.0 PKCE Service
 * Uses Authorization Code Flow with PKCE (no client secret needed)
 * https://lichess.org/api#section/Introduction/Authentication
 */

const LICHESS_HOST = 'https://lichess.org';
const CLIENT_ID = 'chess-analyzer-app'; // You'll need to register this at lichess.org/account/oauth/app
const REDIRECT_URI = window.location.origin + '/auth/callback';
const SCOPES = ['challenge:read', 'challenge:write', 'board:play', 'preference:read'];

// Generate random string for PKCE
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

// Generate code verifier and challenge for PKCE
async function generatePKCE() {
    const codeVerifier = generateRandomString(64);
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return { codeVerifier, codeChallenge };
}

/**
 * Initiate Lichess OAuth flow
 * Redirects to Lichess authorization page
 */
export async function startLichessAuth() {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateRandomString(16);

    // Store for callback
    sessionStorage.setItem('lichess_code_verifier', codeVerifier);
    sessionStorage.setItem('lichess_state', state);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPES.join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state: state,
    });

    window.location.href = `${LICHESS_HOST}/oauth?${params}`;
}

/**
 * Handle OAuth callback
 * Exchange authorization code for access token
 */
export async function handleLichessCallback(code, state) {
    const savedState = sessionStorage.getItem('lichess_state');
    const codeVerifier = sessionStorage.getItem('lichess_code_verifier');

    if (state !== savedState) {
        throw new Error('State mismatch - possible CSRF attack');
    }

    const response = await fetch(`${LICHESS_HOST}/api/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            code_verifier: codeVerifier,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();

    // Clean up
    sessionStorage.removeItem('lichess_code_verifier');
    sessionStorage.removeItem('lichess_state');

    return data.access_token;
}

/**
 * Get current user profile
 */
export async function getLichessProfile(accessToken) {
    const response = await fetch(`${LICHESS_HOST}/api/account`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch profile');
    }

    return response.json();
}

/**
 * Get currently playing games
 */
export async function getPlayingGames(accessToken) {
    const response = await fetch(`${LICHESS_HOST}/api/account/playing`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        return { nowPlaying: [] };
    }

    return response.json();
}

/**
 * Stream a game's moves (NDJSON stream)
 */
export function streamGame(gameId, accessToken, onMove, onEnd) {
    const controller = new AbortController();

    fetch(`${LICHESS_HOST}/api/stream/game/${gameId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        signal: controller.signal,
    })
        .then(async (response) => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    onEnd?.();
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const data = JSON.parse(line);
                            onMove(data);
                        } catch (e) {
                            console.error('Failed to parse game stream:', e);
                        }
                    }
                }
            }
        })
        .catch((err) => {
            if (err.name !== 'AbortError') {
                console.error('Game stream error:', err);
            }
        });

    return () => controller.abort();
}

/**
 * Fetch user's game history
 */
export async function getUserGames(username, options = {}) {
    const params = new URLSearchParams({
        max: options.max || 50,
        pgnInJson: 'true',
        clocks: 'true',
        evals: 'true',
        opening: 'true',
    });

    const response = await fetch(`${LICHESS_HOST}/api/games/user/${username}?${params}`, {
        headers: {
            'Accept': 'application/x-ndjson',
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch games');
    }

    const text = await response.text();
    const games = text
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

    return games;
}

/**
 * Check if user is authenticated
 */
export function getLichessToken() {
    return localStorage.getItem('lichess_token');
}

/**
 * Save token
 */
export function saveLichessToken(token) {
    localStorage.setItem('lichess_token', token);
}

/**
 * Clear token (logout)
 */
export function clearLichessToken() {
    localStorage.removeItem('lichess_token');
}
