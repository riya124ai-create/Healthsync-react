const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const getDb = require('./mongo')
const { ObjectId } = require('mongodb')

// in-memory fallback
const usersMap = (globalThis).__HS_USERS ||= new Map()

console.log('[UserStore] Initialized with fallback storage')

async function findByEmail(email) {
  try {
    const db = await getDb()
    
    if (db) {
      const user = await db.collection('users').findOne({ email })
      if (!user) return null
      
      return {
        id: String(user._id),
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        profile: user.profile || {}
      }
    }
    
    // Fallback to in-memory
    console.warn('[UserStore] Using in-memory fallback for findByEmail:', email)
    for (const user of usersMap.values()) {
      if (user.email === email) return user
    }
    return null
  } catch (error) {
    console.error('[UserStore] Error in findByEmail:', error)
    throw error
  }
}

async function findById(id) {
  try {
    if (!id) {
      console.warn('[UserStore] findById called with empty ID')
      return null
    }
    
    const db = await getDb()
    
    if (db) {
      let filter
      try {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }] }
      } catch (e) {
        filter = { id }
      }
      
      const user = await db.collection('users').findOne(filter)
      if (!user) return null
      
      return {
        id: String(user._id || user.id),
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        profile: user.profile || {}
      }
    }
    
    // Fallback to in-memory
    console.warn('[UserStore] Using in-memory fallback for findById:', id)
    return usersMap.get(id) || null
  } catch (error) {
    console.error('[UserStore] Error in findById:', error)
    throw error
  }
}

async function createUser({ email, password, role, profile }) {
  try {
    if (!email || !password) {
      throw new Error('Email and password are required')
    }
    
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)
    
    const db = await getDb()
    
    if (db) {
      const result = await db.collection('users').insertOne({
        email,
        passwordHash: hash,
        role: role || 'doctor',
        profile: profile || {},
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      console.log('[UserStore] User created in MongoDB:', result.insertedId)
      
      return {
        id: String(result.insertedId),
        email,
        passwordHash: hash,
        role: role || 'doctor',
        profile: profile || {}
      }
    }
    
    // Fallback to in-memory
    console.warn('[UserStore] Using in-memory fallback for createUser:', email)
    const id = uuidv4()
    const user = {
      id,
      email,
      passwordHash: hash,
      role: role || 'doctor',
      profile: profile || {}
    }
    usersMap.set(id, user)
    
    return user
  } catch (error) {
    console.error('[UserStore] Error in createUser:', error)
    throw error
  }
}

module.exports = { findByEmail, findById, createUser }