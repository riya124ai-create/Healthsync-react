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

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET

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

// Configure CORS to allow all origins (for debugging)
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
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
