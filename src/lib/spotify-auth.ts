// Spotify Authentication & Web Playback SDK
// Handles user login and full song playback

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || ''
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/api/spotify/callback` : ''
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ')

export interface SpotifyAuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

// Generate random string for state parameter
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], '')
}

// Redirect user to Spotify login
export function redirectToSpotifyAuth() {
  const state = generateRandomString(16)
  localStorage.setItem('spotify_auth_state', state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state: state
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

// Check if user is authenticated
export function isSpotifyAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  const tokens = localStorage.getItem('spotify_tokens')
  return !!tokens
}

// Get stored tokens
export function getSpotifyTokens(): SpotifyAuthTokens | null {
  if (typeof window === 'undefined') return null
  const tokens = localStorage.getItem('spotify_tokens')
  return tokens ? JSON.parse(tokens) : null
}

// Store tokens
export function setSpotifyTokens(tokens: SpotifyAuthTokens) {
  if (typeof window === 'undefined') return
  localStorage.setItem('spotify_tokens', JSON.stringify(tokens))
}

// Clear tokens (logout)
export function clearSpotifyTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('spotify_tokens')
  localStorage.removeItem('spotify_auth_state')
}

// Refresh access token
export async function refreshSpotifyToken(): Promise<string | null> {
  const tokens = getSpotifyTokens()
  if (!tokens?.refresh_token) return null

  try {
    const response = await fetch('/api/spotify/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token })
    })

    if (!response.ok) throw new Error('Token refresh failed')

    const data = await response.json()
    setSpotifyTokens({ ...tokens, ...data })
    return data.access_token
  } catch (error) {
    console.error('Token refresh error:', error)
    clearSpotifyTokens()
    return null
  }
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getSpotifyTokens()
  if (!tokens) return null

  // Check if token is expired (with 5 min buffer)
  const expiryTime = parseInt(localStorage.getItem('spotify_token_expiry') || '0')
  const now = Date.now()

  if (now >= expiryTime - 300000) {
    // Token expired or expiring soon, refresh it
    return await refreshSpotifyToken()
  }

  return tokens.access_token
}
