const path = require('path')

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') })
} catch (e) {
  // ignore if dotenv is not installed or no .env present
}

const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const authRouter = require('./routes/auth')
const orgRouter = require('./routes/organizations')
const icdRouter = require('./routes/icd11')
const patientsRouter = require('./routes/patients')
const notificationsRouter = require('./routes/notifications')
const groqRouter = require('./routes/groq')

// Environment validation
console.log('=== HealthSync Backend Startup ===')
console.log('Environment:', process.env.NODE_ENV || 'development')

// Critical environment variables check
const requiredEnvVars = {
  JWT_SECRET: process.env.JWT_SECRET,
  MONGODB_URI: process.env.MONGODB_URI,
}

const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value && key === 'JWT_SECRET')
  .map(([key]) => key)

if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:', missingEnvVars.join(', '))
  console.error('JWT_SECRET must be set for authentication to work!')
  process.exit(1)
}

// Warnings for optional but recommended vars
if (!process.env.MONGODB_URI) {
  console.warn('⚠️ WARNING: MONGODB_URI not set. Using in-memory storage (data will be lost on restart).')
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-secret') {
  console.warn('⚠️ WARNING: JWT_SECRET is using default or placeholder value. For production, use a strong random secret!')
}

console.log('✓ Environment validation passed')

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET

// Log configuration
console.log('Server Configuration:')
console.log('- Port:', PORT)
console.log('- Frontend URLs:', (process.env.FRONTEND_URL || 'none') + ', localhost:3000, localhost:5173')
console.log('- Socket.IO:', process.env.ENABLE_SOCKETS === 'true' ? 'enabled' : 'disabled')

// Socket.IO setup - only enable on Render (not Vercel serverless)
const ENABLE_SOCKETS = process.env.ENABLE_SOCKETS === 'true'

let io = null
let userSockets = null

if (ENABLE_SOCKETS) {
  console.log('Socket.IO enabled - Real-time notifications active')
  
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  userSockets = new Map()

  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication error: No token provided'))
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      socket.userId = decoded.id
      socket.userEmail = decoded.email
      socket.userRole = decoded.role
      next()
    } catch (err) {
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userEmail})`)
    
    userSockets.set(socket.userId, socket.id)

    socket.emit('connected', { 
      userId: socket.userId,
      message: 'Successfully connected to HealthSync real-time service'
    })

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`)
      userSockets.delete(socket.userId)
      
      const connectedUserIds = Array.from(userSockets.keys())
      console.log(`Broadcasting updated connected users (${connectedUserIds.length} users):`, connectedUserIds)
      io.emit('connected:users', { users: connectedUserIds })
    })

    socket.on('patient:assign', (data) => {
      socket.emit('patient:assigned:ack', { success: true })
    })

    socket.on('get:connected-users', () => {
      if (socket.userRole === 'organization') {
        const connectedUserIds = Array.from(userSockets.keys())
        socket.emit('connected:users', { users: connectedUserIds })
      }
    })

    const broadcastConnectedUsers = () => {
      const connectedUserIds = Array.from(userSockets.keys())
      io.emit('connected:users', { users: connectedUserIds })
    }
    
    setTimeout(broadcastConnectedUsers, 500)
  })
} else { 
  console.log('Socket.IO disabled - Running in serverless mode (notifications saved to DB only)')
}

app.set('io', io)
app.set('userSockets', userSockets)

// Enhanced CORS configuration
const FRONTEND_URLS = [
  process.env.FRONTEND_URL,
  'https://healthsync-react.vercel.app',
  'https://healthsync-fawn.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173', // Vite default port
].filter(Boolean)

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) {
      console.debug('[CORS] No origin provided, allowing request')
      return callback(null, true)
    }
    
    // Check if origin is in whitelist
    const isAllowed = FRONTEND_URLS.some(url => {
      if (typeof url === 'string') {
        return origin === url || origin.startsWith(url.replace(/\/$/, ''))
      }
      return false
    })
    
    if (isAllowed) {
      console.debug('[CORS] Origin allowed:', origin)
      callback(null, true)
    } else {
      console.warn('[CORS] Origin not allowed:', origin)
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
}

app.use(cors(corsOptions))

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '5mb' }))

app.use('/api/auth', authRouter)
app.use('/api/organizations', orgRouter)
app.use('/api/icd11', icdRouter)
app.use('/api/patients', patientsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/groq', groqRouter)

// Health check endpoint for Render and keep-alive pings
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketConnections: userSockets ? userSockets.size : 0,
    socketEnabled: ENABLE_SOCKETS
  })
})

// Export the app and server for serverless wrappers (Vercel functions) and also allow
// starting a standalone server when run directly (node index.js)
module.exports = { app, server, io }
if (process.env.NODE_ENV === 'development') {
  try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }) } catch (e) {}
}
if (require.main === module) {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`HealthSync backend listening on port ${PORT}`)
  })
}
