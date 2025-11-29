const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { findByEmail, findById, createUser } = require('../lib/userStore')
const getDb = require('../lib/mongo')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    console.log(process.env.MONGODB_URI);
    const found = await findByEmail(email)
    if (!found) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, found.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken(found)
    return res.json({ token, user: { id: found.id, email: found.email, role: found.role, profile: found.profile } })
  } catch (err) {
    console.error('login error', err)
    return res.status(500).json({ error: 'login failed' })
  }
})

router.post('/signup', async (req, res) => {
  try {
    const body = req.body || {}
    const { email, password, role = 'doctor', profile = {} } = body
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const existing = await findByEmail(email)
    if (existing) return res.status(409).json({ error: 'user already exists' })

    const user = await createUser({ email, password, role, profile })

    if (role === 'organization') {
      try {
        const db = await getDb()
        const orgName = profile?.organization || profile?.name || ''
        if (db && orgName) {
          const organizations = db.collection('organizations')
          const slug = String(orgName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          const orgRes = await organizations.insertOne({ name: orgName, slug, admin: user.id, createdAt: new Date() })

          try {
            const usersCol = db.collection('users')
            let filter = { id: user.id }
            try { filter = { _id: new (require('mongodb').ObjectId)(user.id) } } catch (e) { filter = { id: user.id } }
            await usersCol.updateOne(filter, { $set: { 'profile.organizationId': String(orgRes.insertedId) } })
            user.profile = { ...(user.profile || {}), organizationId: String(orgRes.insertedId) }
          } catch (e) {
            console.warn('failed to link user to organization', e)
          }
        }
      } catch (e) {
        console.warn('organization save skipped', e)
      }
    }

    const token = signToken(user)
    return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, profile: user.profile } })
  } catch (err) {
    console.error('signup error', err)
    return res.status(500).json({ error: 'signup failed' })
  }
})

router.get('/me', async (req, res) => {
  try {
    const auth = req.get('authorization')
    let token = null
    if (auth && auth.startsWith('Bearer ')) token = auth.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'missing token' })

    let data
    try {
      data = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ error: 'invalid token' })
    }

    let user = await findById(data.id)
    if (!user && data.email) user = await findByEmail(data.email)
    if (!user) return res.status(404).json({ error: 'user not found' })

    return res.json({ user: { id: user.id, email: user.email, role: user.role, profile: user.profile } })
  } catch (err) {
    console.error('me error', err)
    return res.status(500).json({ error: 'failed to load user' })
  }
})

router.post('/logout', async (req, res) => {
  // no-op for token-based logout; return ok
  return res.json({ ok: true })
})

// Google Sign-in: verify id_token, require PIN for Google sign-ins
router.post('/google', async (req, res) => {
  try {
    const { credential, pin, setPinForFuture } = req.body || {}
    if (!credential) return res.status(400).json({ error: 'credential required' })

    // fetch token info from Google
    const https = require('https')
    const payload = await new Promise((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      https.get(url, (gres) => {
        let raw = ''
        gres.on('data', (c) => raw += c)
        gres.on('end', () => {
          if (gres.statusCode !== 200) return reject(new Error('invalid credential'))
          try {
            const j = JSON.parse(raw)
            resolve(j)
          } catch (e) { reject(e) }
        })
      }).on('error', (err) => reject(err))
    })

    const g = payload || {}
    const email = g.email
    const emailVerified = g.email_verified === 'true' || g.email_verified === true
    if (!email || !emailVerified) return res.status(401).json({ error: 'email not verified by Google' })

    const db = await getDb()
    let usersCol = null
    if (db) usersCol = db.collection('users')

    // try to find existing user doc (full doc) to access profile.googlePinHash
    let userDoc = null
    if (usersCol) userDoc = await usersCol.findOne({ email })
    else {
      const found = await findByEmail(email)
      if (found) userDoc = { _id: found.id, email: found.email, role: found.role, profile: found.profile }
    }

    const bcrypt = require('bcryptjs')

    if (userDoc) {
      // existing user: check if google PIN hash exists
      const savedHash = (userDoc.profile && userDoc.profile.googlePinHash) || null
      // If no PIN provided, return status indicating whether a PIN is already set
      if (!pin) {
        return res.json({ needPin: true, hasPin: !!savedHash })
      }
      if (savedHash) {
        const ok = await bcrypt.compare(String(pin), String(savedHash))
        if (!ok) return res.status(401).json({ error: 'Invalid PIN' })
        // issue token
        const userObj = { id: String(userDoc._id || userDoc.id), email: userDoc.email, role: userDoc.role }
        const token = signToken(userObj)
        return res.json({ token, user: { id: userObj.id, email: userObj.email, role: userObj.role, profile: userDoc.profile } })
      }

      // no saved PIN yet: require pin + setPinForFuture to be true to set
      if (!setPinForFuture) return res.status(400).json({ error: 'PIN required to enable Google sign-in for this account' })
      const salt = await bcrypt.genSalt(10)
      const hash = await bcrypt.hash(String(pin), salt)
      // update profile.googlePinHash
      try {
        if (usersCol) {
          await usersCol.updateOne({ email }, { $set: { 'profile.googlePinHash': hash, 'profile.googleSub': g.sub } })
          const updated = await usersCol.findOne({ email })
          const userObj = { id: String(updated._id), email: updated.email, role: updated.role }
          const token = signToken(userObj)
          return res.json({ token, user: { id: userObj.id, email: userObj.email, role: userObj.role, profile: updated.profile } })
        }
      } catch (e) {
        console.error('failed to save google PIN', e)
        return res.status(500).json({ error: 'failed to save PIN' })
      }
    }

    // user not found: create a new user and set PIN (require PIN + setPinForFuture)
    if (!pin || !setPinForFuture) return res.status(400).json({ error: 'PIN required to create account via Google' })
    try {
      const randomPassword = Math.random().toString(36).slice(2, 12)
      const profile = { name: g.name || '', picture: g.picture || '', googleSub: g.sub }
      const newUser = await createUser({ email, password: randomPassword, role: 'doctor', profile })
      // store hashed PIN
      const salt = await bcrypt.genSalt(10)
      const hash = await bcrypt.hash(String(pin), salt)
      if (usersCol) {
        const { ObjectId } = require('mongodb')
        let filter = { email }
        try { filter = { _id: new ObjectId(newUser.id) } } catch (e) { filter = { email } }
        await usersCol.updateOne(filter, { $set: { 'profile.googlePinHash': hash } })
        const created = await usersCol.findOne(filter)
        const userObj = { id: String(created._id), email: created.email, role: created.role }
        const token = signToken(userObj)
        return res.status(201).json({ token, user: { id: userObj.id, email: userObj.email, role: userObj.role, profile: created.profile } })
      }
    } catch (err) {
      console.error('create google user failed', err)
      return res.status(500).json({ error: 'failed to create user' })
    }

    return res.status(500).json({ error: 'unable to complete google sign-in' })
  } catch (err) {
    console.error('google sign-in error', err)
    return res.status(500).json({ error: 'google sign-in failed' })
  }
})
module.exports = router
