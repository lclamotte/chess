/**
 * Chess.com Public API Service
 * Uses the public API which only requires a username (no OAuth)
 * https://www.chess.com/news/view/published-data-api
 */

const CHESSCOM_API = 'https://api.chess.com/pub';

/**
 * Get Chess.com player profile
 */
export async function getChesscomProfile(username) {
    const response = await fetch(`${CHESSCOM_API}/player/${username.toLowerCase()}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Player not found on Chess.com');
        }
        throw new Error('Failed to fetch Chess.com profile');
    }

    return response.json();
}

/**
 * Get Chess.com player stats (ratings for all modes)
 */
export async function getChesscomStats(username) {
    const response = await fetch(`${CHESSCOM_API}/player/${username.toLowerCase()}/stats`);

    if (!response.ok) {
        throw new Error('Failed to fetch Chess.com stats');
    }

    return response.json();
}

/**
 * Get list of game archives (monthly URLs)
 */
export async function getChesscomArchives(username) {
    const response = await fetch(`${CHESSCOM_API}/player/${username.toLowerCase()}/games/archives`);

    if (!response.ok) {
        throw new Error('Failed to fetch game archives');
    }

    const data = await response.json();
    return data.archives || [];
}

/**
 * Get games from a specific monthly archive
 */
export async function getChesscomMonthlyGames(archiveUrl) {
    const response = await fetch(archiveUrl);

    if (!response.ok) {
        throw new Error('Failed to fetch games from archive');
    }

    const data = await response.json();
    return data.games || [];
}

/**
 * Get recent games (from last N months)
 * @param {string} username 
 * @param {number} maxGames - Maximum number of games to return
 * @returns {Promise<Array>} Array of games sorted by date (newest first)
 */
export async function getChesscomRecentGames(username, maxGames = 50) {
    const archives = await getChesscomArchives(username);

    if (archives.length === 0) {
        return [];
    }

    // Get games from most recent archives (work backwards)
    let allGames = [];
    const recentArchives = archives.slice(-3); // Last 3 months

    for (const archiveUrl of recentArchives.reverse()) {
        const games = await getChesscomMonthlyGames(archiveUrl);
        allGames = allGames.concat(games);

        if (allGames.length >= maxGames) {
            break;
        }
    }

    // Sort by end_time (newest first) and limit
    return allGames
        .sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
        .slice(0, maxGames);
}

/**
 * Convert Chess.com game to common format (matching Lichess structure)
 */
export function normalizeChesscomGame(game, username) {
    const isWhite = game.white?.username?.toLowerCase() === username.toLowerCase();
    const playerData = isWhite ? game.white : game.black;
    const opponentData = isWhite ? game.black : game.white;

    // Determine winner
    let winner = null;
    if (game.white?.result === 'win') winner = 'white';
    else if (game.black?.result === 'win') winner = 'black';

    return {
        id: game.uuid || game.url?.split('/').pop() || `${game.end_time}`,
        source: 'chesscom',
        createdAt: (game.end_time || 0) * 1000, // Convert to ms
        players: {
            white: {
                user: { name: game.white?.username },
                rating: game.white?.rating,
            },
            black: {
                user: { name: game.black?.username },
                rating: game.black?.rating,
            },
        },
        winner,
        status: game.white?.result || game.black?.result || 'unknown',
        moves: extractMovesFromPgn(game.pgn),
        pgn: game.pgn,
        opening: { name: extractOpeningFromPgn(game.pgn) },
        speed: game.time_class,
        url: game.url,
    };
}

/**
 * Extract moves string from PGN (Chess.com format)
 */
function extractMovesFromPgn(pgn) {
    if (!pgn) return '';

    // Remove headers (lines starting with [)
    const lines = pgn.split('\n').filter(line => !line.startsWith('[') && line.trim());
    const moveText = lines.join(' ');

    // Remove move numbers and result, extract just the moves
    return moveText
        .replace(/\d+\.\s*/g, '') // Remove move numbers
        .replace(/\{[^}]*\}/g, '') // Remove comments
        .replace(/\([^)]*\)/g, '') // Remove variations
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove result
        .trim();
}

/**
 * Extract opening name from PGN headers
 */
function extractOpeningFromPgn(pgn) {
    if (!pgn) return 'Unknown';

    const ecoMatch = pgn.match(/\[ECOUrl "[^"]*\/([^"]+)"\]/);
    if (ecoMatch) {
        return ecoMatch[1].replace(/-/g, ' ');
    }

    const openingMatch = pgn.match(/\[Opening "([^"]+)"\]/);
    if (openingMatch) {
        return openingMatch[1];
    }

    return 'Unknown';
}

/**
 * Storage helpers
 */
export function getChesscomUsername() {
    return localStorage.getItem('chesscom_username');
}

export function saveChesscomUsername(username) {
    localStorage.setItem('chesscom_username', username);
}

export function clearChesscomUsername() {
    localStorage.removeItem('chesscom_username');
}
