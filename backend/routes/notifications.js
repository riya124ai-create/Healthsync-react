const express = require('express')
const router = express.Router()
const getDb = require('../lib/mongo')
const { ObjectId } = require('mongodb')

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) return res.status(401).json({ error: 'No token provided' })
  
  const jwt = require('jsonwebtoken')
  const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' })
    req.user = user
    next()
  })
}

// GET /api/notifications - Get all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const userId = req.user.id || req.user.email
    
    // Get notifications for this user, sorted by newest first
    const notifications = await db.collection('notifications')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(100) // Limit to last 100 notifications
      .toArray()

    const formatted = notifications.map(n => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read || false,
      data: n.data || {}
    }))

    res.json({ notifications: formatted })
  } catch (err) {
    console.error('Error fetching notifications:', err)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// POST /api/notifications - Create a new notification (internal use)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const { userId, type, title, message, data } = req.body
    
    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const notification = {
      userId,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      data: data || {}
    }

    const result = await db.collection('notifications').insertOne(notification)
    
    res.json({
      id: String(result.insertedId),
      ...notification
    })
  } catch (err) {
    console.error('Error creating notification:', err)
    res.status(500).json({ error: 'Failed to create notification' })
  }
})

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const notificationId = req.params.id
    const userId = req.user.id || req.user.email

    let filter
    try {
      filter = { _id: new ObjectId(notificationId), userId }
    } catch (e) {
      filter = { id: notificationId, userId }
    }

    const result = await db.collection('notifications').updateOne(
      filter,
      { $set: { read: true, readAt: new Date() } }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Error marking notification as read:', err)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const userId = req.user.id || req.user.email

    const result = await db.collection('notifications').updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    )

    res.json({ success: true, count: result.modifiedCount })
  } catch (err) {
    console.error('Error marking all notifications as read:', err)
    res.status(500).json({ error: 'Failed to mark notifications as read' })
  }
})

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const notificationId = req.params.id
    const userId = req.user.id || req.user.email

    let filter
    try {
      filter = { _id: new ObjectId(notificationId), userId }
    } catch (e) {
      filter = { id: notificationId, userId }
    }

    const result = await db.collection('notifications').deleteOne(filter)

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting notification:', err)
    res.status(500).json({ error: 'Failed to delete notification' })
  }
})

// DELETE /api/notifications - Clear all notifications for user
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const userId = req.user.id || req.user.email

    const result = await db.collection('notifications').deleteMany({ userId })

    res.json({ success: true, count: result.deletedCount })
  } catch (err) {
    console.error('Error clearing notifications:', err)
    res.status(500).json({ error: 'Failed to clear notifications' })
  }
})

// DELETE /api/notifications/patient/:patientId - Delete patient assignment notification
router.delete('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const db = await getDb()
    if (!db) {
      return res.status(500).json({ error: 'Database not available' })
    }

    const patientId = req.params.patientId
    const userId = req.user.id || req.user.email

    const result = await db.collection('notifications').deleteOne({
      userId,
      type: 'patient-assigned',
      'data.patientId': patientId
    })

    res.json({ success: true, deleted: result.deletedCount > 0 })
  } catch (err) {
    console.error('Error deleting patient notification:', err)
    res.status(500).json({ error: 'Failed to delete notification' })
  }
})

module.exports = router
