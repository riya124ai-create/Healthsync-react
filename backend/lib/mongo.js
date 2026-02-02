const { MongoClient } = require('mongodb')

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'healthsync'

console.log('=== MongoDB Configuration ===')
if (uri) {
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
  console.log('URI:', maskedUri)
  console.log('Database:', dbName)
} else {
  console.log('URI: not set (using in-memory fallback)')
}

/**
 * Cached client across hot reloads
 */
let cached = global.__HS_MONGO_CACHED

/**
 * Get MongoDB database connection with retry logic
 * @param {number} retries - Number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<Db|null>}
 */
async function getDb(retries = 3, delay = 1000) {
  // Return in-memory fallback if no URI
  if (!uri) {
    console.warn('[MongoDB] No MONGODB_URI set, using in-memory storage')
    return null
  }

  // Return cached connection if available
  if (cached && cached.client && cached.db) {
    // Check if client is still connected
    if (cached.client.topology && cached.client.topology.isConnected()) {
      return cached.db
    } else {
      console.warn('[MongoDB] Cached client disconnected, reconnecting...')
      cached = null
    }
  }

  // Attempt to connect with retries
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[MongoDB] Connection attempt ${attempt}/${retries}...`)
      
      const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Connection pooling
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      })
      
      await client.connect()
      
      const db = client.db(dbName)
      
      // Test the connection
      await db.command({ ping: 1 })
      
      // Cache the connection
      cached = { client, db }
      global.__HS_MONGO_CACHED = cached
      
      console.log('[MongoDB] ✓ Connected successfully')
      
      // Setup connection event handlers
      client.on('error', (error) => {
        console.error('[MongoDB] Connection error:', error)
      })
      
      client.on('timeout', () => {
        console.warn('[MongoDB] Connection timeout')
      })
      
      client.on('close', () => {
        console.warn('[MongoDB] Connection closed')
        // Clear cache on close
        if (cached && cached.client === client) {
          cached = null
          global.__HS_MONGO_CACHED = null
        }
      })
      
      return db
      
    } catch (error) {
      console.error(`[MongoDB] Connection attempt ${attempt} failed:`, error.message)
      
      if (attempt < retries) {
        console.log(`[MongoDB] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error('[MongoDB] All connection attempts failed')
        
        // If all retries fail, return null to use in-memory fallback
        console.warn('[MongoDB] Falling back to in-memory storage')
        return null
      }
    }
  }
}

// Graceful shutdown handler
function closeConnection() {
  if (cached && cached.client) {
    console.log('[MongoDB] Closing connection...')
    cached.client.close().then(() => {
      console.log('[MongoDB] Connection closed')
    }).catch(err => {
      console.error('[MongoDB] Error closing connection:', err)
    })
  }
}

// Register shutdown handlers
process.on('SIGINT', closeConnection)
process.on('SIGTERM', closeConnection)
process.on('exit', closeConnection)

module.exports = getDb