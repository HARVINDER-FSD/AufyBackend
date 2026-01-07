"use strict";
// Spotify Authentication & Web Playback SDK
// Handles user login and full song playback
Object.defineProperty(exports, "__esModule", { value: true });
exports.redirectToSpotifyAuth = redirectToSpotifyAuth;
exports.isSpotifyAuthenticated = isSpotifyAuthenticated;
exports.getSpotifyTokens = getSpotifyTokens;
exports.setSpotifyTokens = setSpotifyTokens;
exports.clearSpotifyTokens = clearSpotifyTokens;
exports.refreshSpotifyToken = refreshSpotifyToken;
exports.getValidAccessToken = getValidAccessToken;
const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/api/spotify/callback` : '';
const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state'
].join(' ');
// Generate random string for state parameter
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}
// Redirect user to Spotify login
function redirectToSpotifyAuth() {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state: state
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}
// Check if user is authenticated
function isSpotifyAuthenticated() {
    if (typeof window === 'undefined')
        return false;
    const tokens = localStorage.getItem('spotify_tokens');
    return !!tokens;
}
// Get stored tokens
function getSpotifyTokens() {
    if (typeof window === 'undefined')
        return null;
    const tokens = localStorage.getItem('spotify_tokens');
    return tokens ? JSON.parse(tokens) : null;
}
// Store tokens
function setSpotifyTokens(tokens) {
    if (typeof window === 'undefined')
        return;
    localStorage.setItem('spotify_tokens', JSON.stringify(tokens));
}
// Clear tokens (logout)
function clearSpotifyTokens() {
    if (typeof window === 'undefined')
        return;
    localStorage.removeItem('spotify_tokens');
    localStorage.removeItem('spotify_auth_state');
}
// Refresh access token
async function refreshSpotifyToken() {
    const tokens = getSpotifyTokens();
    if (!tokens?.refresh_token)
        return null;
    try {
        const response = await fetch('/api/spotify/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: tokens.refresh_token })
        });
        if (!response.ok)
            throw new Error('Token refresh failed');
        const data = await response.json();
        setSpotifyTokens({ ...tokens, ...data });
        return data.access_token;
    }
    catch (error) {
        console.error('Token refresh error:', error);
        clearSpotifyTokens();
        return null;
    }
}
// Get valid access token (refresh if needed)
async function getValidAccessToken() {
    const tokens = getSpotifyTokens();
    if (!tokens)
        return null;
    // Check if token is expired (with 5 min buffer)
    const expiryTime = parseInt(localStorage.getItem('spotify_token_expiry') || '0');
    const now = Date.now();
    if (now >= expiryTime - 300000) {
        // Token expired or expiring soon, refresh it
        return await refreshSpotifyToken();
    }
    return tokens.access_token;
}
