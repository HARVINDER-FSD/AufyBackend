// Spotify Web Playback SDK Integration
// Handles full song playback in the browser

import { getValidAccessToken } from './spotify-auth'

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: any
  }
}

export class SpotifyPlayer {
  private player: any = null
  private deviceId: string | null = null
  private isReady: boolean = false

  // Initialize the Spotify Web Playback SDK
  async initialize(): Promise<boolean> {
    const token = await getValidAccessToken()
    if (!token) {
      console.error('No valid Spotify token')
      return false
    }

    // Load SDK script if not already loaded
    if (!window.Spotify) {
      await this.loadSDK()
    }

    return new Promise((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        this.setupPlayer(token)
        resolve(true)
      }

      // If SDK already loaded, call immediately
      if (window.Spotify) {
        window.onSpotifyWebPlaybackSDKReady()
      }
    })
  }

  // Load Spotify SDK script
  private loadSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="spotify-player"]')) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Spotify SDK'))
      document.body.appendChild(script)
    })
  }

  // Setup the player instance
  private setupPlayer(token: string) {
    this.player = new window.Spotify.Player({
      name: 'Anufy Music Player',
      getOAuthToken: (cb: (token: string) => void) => {
        cb(token)
      },
      volume: 0.8
    })

    // Ready event
    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('✅ Spotify Player Ready:', device_id)
      this.deviceId = device_id
      this.isReady = true
    })

    // Not Ready event
    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('❌ Spotify Player Not Ready:', device_id)
      this.isReady = false
    })

    // Error handling
    this.player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Initialization Error:', message)
    })

    this.player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Authentication Error:', message)
    })

    this.player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Account Error:', message)
    })

    this.player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Playback Error:', message)
    })

    // Connect to the player
    this.player.connect()
  }

  // Play a track by Spotify URI
  async playTrack(spotifyUri: string, positionMs: number = 0): Promise<boolean> {
    if (!this.isReady || !this.deviceId) {
      console.error('Player not ready')
      return false
    }

    const token = await getValidAccessToken()
    if (!token) return false

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uris: [spotifyUri],
          position_ms: positionMs
        })
      })

      return response.ok
    } catch (error) {
      console.error('Play track error:', error)
      return false
    }
  }

  // Pause playback
  async pause(): Promise<void> {
    if (this.player) {
      await this.player.pause()
    }
  }

  // Resume playback
  async resume(): Promise<void> {
    if (this.player) {
      await this.player.resume()
    }
  }

  // Seek to position (milliseconds)
  async seek(positionMs: number): Promise<void> {
    if (this.player) {
      await this.player.seek(positionMs)
    }
  }

  // Get current playback state
  async getState(): Promise<any> {
    if (!this.player) return null
    return await this.player.getCurrentState()
  }

  // Set volume (0.0 to 1.0)
  async setVolume(volume: number): Promise<void> {
    if (this.player) {
      await this.player.setVolume(volume)
    }
  }

  // Disconnect player
  disconnect(): void {
    if (this.player) {
      this.player.disconnect()
      this.isReady = false
      this.deviceId = null
    }
  }

  // Check if player is ready
  isPlayerReady(): boolean {
    return this.isReady
  }

  // Get device ID
  getDeviceId(): string | null {
    return this.deviceId
  }
}

// Singleton instance
let playerInstance: SpotifyPlayer | null = null

export function getSpotifyPlayer(): SpotifyPlayer {
  if (!playerInstance) {
    playerInstance = new SpotifyPlayer()
  }
  return playerInstance
}
