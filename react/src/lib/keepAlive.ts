/**
 * Keep-alive utility for waking up Render free tier backend
 * Pings backend on app load and navigation to prevent cold starts
 * Render free tier spins down after 15 minutes of inactivity
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const HEALTH_ENDPOINT = '/health'

let lastPingTime = 0
const MIN_PING_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Ping the backend health endpoint to keep it awake
 */
async function pingBackend(): Promise<boolean> {
  try {
    console.log('Pinging backend to keep server awake...')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const response = await fetch(`${BACKEND_URL}${HEALTH_ENDPOINT}`, {
      method: 'GET',
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      console.log('Backend is awake and responding')
      return true
    } else {
      console.warn('Backend responded with non-OK status:', response.status)
      return false
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Backend ping timed out - server may be waking up')
    } else {
      console.error('Failed to ping backend:', error)
    }
    return false
  }
}

/**
 * Wake up backend on demand (called on page load/navigation)
 * Includes throttling to prevent excessive requests
 */
export async function wakeUpOnPageLoad(): Promise<void> {
  const now = Date.now()
  const timeSinceLastPing = now - lastPingTime
  
  // Throttle: Skip if we pinged recently (within MIN_PING_INTERVAL)
  if (timeSinceLastPing < MIN_PING_INTERVAL) {
    console.log('Skipping ping - too soon since last ping')
    return
  }
  
  lastPingTime = now
  console.log('Waking up backend on page load...')
  await pingBackend()
}

/**
 * Manually trigger a backend ping (useful for testing or on-demand wake-up)
 */
export async function wakeUpBackend(): Promise<boolean> {
  console.log('Manually waking up backend...')
  return await pingBackend()
}
