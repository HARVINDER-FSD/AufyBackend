"use strict";
// Spotify Web Playback SDK Integration
// Handles full song playback in the browser
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyPlayer = void 0;
exports.getSpotifyPlayer = getSpotifyPlayer;
const spotify_auth_1 = require("./spotify-auth");
class SpotifyPlayer {
    constructor() {
        this.player = null;
        this.deviceId = null;
        this.isReady = false;
    }
    // Initialize the Spotify Web Playback SDK
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield (0, spotify_auth_1.getValidAccessToken)();
            if (!token) {
                console.error('No valid Spotify token');
                return false;
            }
            // Load SDK script if not already loaded
            if (!window.Spotify) {
                yield this.loadSDK();
            }
            return new Promise((resolve) => {
                window.onSpotifyWebPlaybackSDKReady = () => {
                    this.setupPlayer(token);
                    resolve(true);
                };
                // If SDK already loaded, call immediately
                if (window.Spotify) {
                    window.onSpotifyWebPlaybackSDKReady();
                }
            });
        });
    }
    // Load Spotify SDK script
    loadSDK() {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="spotify-player"]')) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
            document.body.appendChild(script);
        });
    }
    // Setup the player instance
    setupPlayer(token) {
        this.player = new window.Spotify.Player({
            name: 'Anufy Music Player',
            getOAuthToken: (cb) => {
                cb(token);
            },
            volume: 0.8
        });
        // Ready event
        this.player.addListener('ready', ({ device_id }) => {
            console.log('✅ Spotify Player Ready:', device_id);
            this.deviceId = device_id;
            this.isReady = true;
        });
        // Not Ready event
        this.player.addListener('not_ready', ({ device_id }) => {
            console.log('❌ Spotify Player Not Ready:', device_id);
            this.isReady = false;
        });
        // Error handling
        this.player.addListener('initialization_error', ({ message }) => {
            console.error('Initialization Error:', message);
        });
        this.player.addListener('authentication_error', ({ message }) => {
            console.error('Authentication Error:', message);
        });
        this.player.addListener('account_error', ({ message }) => {
            console.error('Account Error:', message);
        });
        this.player.addListener('playback_error', ({ message }) => {
            console.error('Playback Error:', message);
        });
        // Connect to the player
        this.player.connect();
    }
    // Play a track by Spotify URI
    playTrack(spotifyUri_1) {
        return __awaiter(this, arguments, void 0, function* (spotifyUri, positionMs = 0) {
            if (!this.isReady || !this.deviceId) {
                console.error('Player not ready');
                return false;
            }
            const token = yield (0, spotify_auth_1.getValidAccessToken)();
            if (!token)
                return false;
            try {
                const response = yield fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        uris: [spotifyUri],
                        position_ms: positionMs
                    })
                });
                return response.ok;
            }
            catch (error) {
                console.error('Play track error:', error);
                return false;
            }
        });
    }
    // Pause playback
    pause() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.player) {
                yield this.player.pause();
            }
        });
    }
    // Resume playback
    resume() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.player) {
                yield this.player.resume();
            }
        });
    }
    // Seek to position (milliseconds)
    seek(positionMs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.player) {
                yield this.player.seek(positionMs);
            }
        });
    }
    // Get current playback state
    getState() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.player)
                return null;
            return yield this.player.getCurrentState();
        });
    }
    // Set volume (0.0 to 1.0)
    setVolume(volume) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.player) {
                yield this.player.setVolume(volume);
            }
        });
    }
    // Disconnect player
    disconnect() {
        if (this.player) {
            this.player.disconnect();
            this.isReady = false;
            this.deviceId = null;
        }
    }
    // Check if player is ready
    isPlayerReady() {
        return this.isReady;
    }
    // Get device ID
    getDeviceId() {
        return this.deviceId;
    }
}
exports.SpotifyPlayer = SpotifyPlayer;
// Singleton instance
let playerInstance = null;
function getSpotifyPlayer() {
    if (!playerInstance) {
        playerInstance = new SpotifyPlayer();
    }
    return playerInstance;
}
