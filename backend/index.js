const path = require('path')
// load local .env for development
try {
  // prefer backend/.env
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

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Store user socket connections: userId -> socketId
const userSockets = new Map()

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error('Authentication error: No token provided'))
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    socket.userId = decoded.id || decoded.email
    socket.userEmail = decoded.email
    socket.userRole = decoded.role
    next()
  } catch (err) {
    next(new Error('Authentication error: Invalid token'))
  }
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (${socket.userEmail})`)
  
  // Store user's socket connection
  userSockets.set(socket.userId, socket.id)

  // Notify user they're connected
  socket.emit('connected', { 
    userId: socket.userId,
    message: 'Successfully connected to HealthSync real-time service'
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`)
    userSockets.delete(socket.userId)
  })

  // Handle patient assignment notification (emitted from API routes)
  socket.on('patient:assign', (data) => {
    // This is handled by the API route, but we listen for confirmation
    socket.emit('patient:assigned:ack', { success: true })
  })
})

// Make io and userSockets available to routes
app.set('io', io)
app.set('userSockets', userSockets)

app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.use('/api/auth', authRouter)
app.use('/api/organizations', orgRouter)
app.use('/api/icd11', icdRouter)
app.use('/api/patients', patientsRouter)
app.use('/api/notifications', notificationsRouter)

app.get('/health', (req, res) => res.json({ ok: true }))

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
    console.log(`Socket.IO server ready for real-time notifications`)
  })
}
