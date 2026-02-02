const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { findByEmail, findById, createUser } = require('../lib/userStore')
const getDb = require('../lib/mongo')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET is not defined!')
  throw new Error('JWT_SECRET environment variable is required')
}

console.log('✓ Auth routes initialized. JWT_SECRET:', JWT_SECRET ? '✓ Set' : '❌ Missing')

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Request validation helper
function validateRequestBody(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field])
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` }
  }
  return { valid: true }
}

// Error response helper
function sendError(res, status, error, debugInfo = null) {
  const isDev = process.env.NODE_ENV === 'development'
  const response = { error }
  
  if (isDev && debugInfo) {
    response.debug = debugInfo
  }
  
  return res.status(status).json(response)
}

// Success response helper
function sendSuccess(res, data, status = 200) {
  return res.status(status).json(data)
}

/**
 * @route POST /api/auth/login
 * @desc Login user
 */
router.post('/login', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Login attempt started`)
  
  try {
    const { email, password } = req.body || {}
    
    // Validate input
    const validation = validateRequestBody(req.body, ['email', 'password'])
    if (!validation.valid) {
      console.warn(`[Auth] [${requestId}] Validation failed:`, validation.error)
      return sendError(res, 400, 'Email and password are required')
    }

    console.log(`[Auth] [${requestId}] Looking up user:`, email)
    const found = await findByEmail(email)
    
    if (!found) {
      console.warn(`[Auth] [${requestId}] User not found:`, email)
      // Use generic error message for security
      return sendError(res, 401, 'Invalid credentials. Please check your email and password.')
    }

    console.log(`[Auth] [${requestId}] User found, verifying password...`)
    const isValidPassword = await bcrypt.compare(password, found.passwordHash)
    
    if (!isValidPassword) {
      console.warn(`[Auth] [${requestId}] Invalid password for user:`, email)
      return sendError(res, 401, 'Invalid credentials. Please check your email and password.')
    }

    console.log(`[Auth] [${requestId}] Password verified, generating token...`)
    const token = signToken(found)
    
    const response = {
      token,
      user: {
        id: found.id,
        email: found.email,
        role: found.role,
        profile: found.profile || {}
      }
    }

    console.log(`[Auth] [${requestId}] Login successful for:`, email)
    return sendSuccess(res, response)
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Login error:`, err)
    return sendError(res, 500, 'Login failed. Please try again.', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

/**
 * @route POST /api/auth/signup
 * @desc Register new user
 */
router.post('/signup', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Signup attempt started`)
  
  try {
    const body = req.body || {}
    const { email, password, role = 'doctor', profile = {} } = body
    
    // Validate input
    const validation = validateRequestBody(body, ['email', 'password'])
    if (!validation.valid) {
      console.warn(`[Auth] [${requestId}] Validation failed:`, validation.error)
      return sendError(res, 400, validation.error)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return sendError(res, 400, 'Invalid email format')
    }

    // Check if user already exists
    console.log(`[Auth] [${requestId}] Checking existing user:`, email)
    const existing = await findByEmail(email)
    
    if (existing) {
      console.warn(`[Auth] [${requestId}] User already exists:`, email)
      return sendError(res, 409, 'User with this email already exists')
    }

    console.log(`[Auth] [${requestId}] Creating new user:`, email)
    const user = await createUser({ email, password, role, profile })
    console.log(`[Auth] [${requestId}] User created successfully:`, user.id)

    // Handle organization creation if needed
    if (role === 'organization') {
      console.log(`[Auth] [${requestId}] Creating organization for admin:`, user.id)
      try {
        const db = await getDb()
        const orgName = profile?.organization || profile?.name || ''
        
        if (db && orgName) {
          const organizations = db.collection('organizations')
          const slug = String(orgName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          
          const orgRes = await organizations.insertOne({
            name: orgName,
            slug,
            admin: user.id,
            createdAt: new Date()
          })

          console.log(`[Auth] [${requestId}] Organization created:`, orgRes.insertedId)

          try {
            const usersCol = db.collection('users')
            let filter = { id: user.id }
            try {
              filter = { _id: new (require('mongodb').ObjectId)(user.id) }
            } catch (e) {
              filter = { id: user.id }
            }
            
            await usersCol.updateOne(
              filter,
              { $set: { 'profile.organizationId': String(orgRes.insertedId) } }
            )
            
            user.profile = { ...(user.profile || {}), organizationId: String(orgRes.insertedId) }
            console.log(`[Auth] [${requestId}] Linked user to organization`)
          } catch (e) {
            console.warn(`[Auth] [${requestId}] Failed to link user to organization:`, e)
          }
        }
      } catch (e) {
        console.warn(`[Auth] [${requestId}] Organization save skipped:`, e)
      }
    }

    // Generate token
    const token = signToken(user)
    
    const response = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile || {}
      }
    }

    console.log(`[Auth] [${requestId}] Signup successful for:`, email)
    return sendSuccess(res, response, 201)
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Signup error:`, err)
    return sendError(res, 500, 'Signup failed. Please try again.', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

/**
 * @route GET /api/auth/me
 * @desc Get current user from token
 */
router.get('/me', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Get current user request`)
  
  try {
    const authHeader = req.get('authorization')
    console.log(`[Auth] [${requestId}] Authorization header present:`, !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[Auth] [${requestId}] Missing or invalid authorization header`)
      return sendError(res, 401, 'Missing or invalid authorization token')
    }

    const token = authHeader.split(' ')[1]
    console.log(`[Auth] [${requestId}] Token received, length:`, token.length)

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
      console.log(`[Auth] [${requestId}] Token verified for user:`, decoded.email)
    } catch (err) {
      console.warn(`[Auth] [${requestId}] Invalid token:`, err.message)
      return sendError(res, 401, 'Invalid or expired token')
    }

    let user = await findById(decoded.id)
    if (!user && decoded.email) {
      console.log(`[Auth] [${requestId}] User not found by ID, trying email:`, decoded.email)
      user = await findByEmail(decoded.email)
    }
    
    if (!user) {
      console.warn(`[Auth] [${requestId}] User not found:`, decoded.id)
      return sendError(res, 404, 'User not found')
    }

    const response = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile || {}
      }
    }

    console.log(`[Auth] [${requestId}] User retrieved successfully:`, user.email)
    return sendSuccess(res, response)
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Get user error:`, err)
    return sendError(res, 500, 'Failed to load user', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

/**
 * @route PUT /api/auth/me
 * @desc Update current user profile
 */
router.put('/me', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Update profile request`)
  
  try {
    const authHeader = req.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Missing or invalid authorization token')
    }

    const token = authHeader.split(' ')[1]

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return sendError(res, 401, 'Invalid or expired token')
    }

    let user = await findById(decoded.id)
    if (!user && decoded.email) {
      user = await findByEmail(decoded.email)
    }
    
    if (!user) {
      return sendError(res, 404, 'User not found')
    }

    const db = await getDb()
    if (!db) {
      return sendError(res, 503, 'Database unavailable')
    }

    const updates = req.body || {}
    const updateFields = {}

    // Handle email update
    if (updates.email && updates.email !== user.email) {
      const existing = await findByEmail(updates.email)
      if (existing && existing.id !== user.id) {
        return sendError(res, 409, 'Email already in use')
      }
      updateFields.email = updates.email
    }

    const profileUpdates = {}
    
    if (user.role === 'organization' && updates.admin !== undefined) {
      profileUpdates.admin = updates.admin
    } else if (updates.name !== undefined) {
      profileUpdates.name = updates.name
    }
    
    if (updates.specialty !== undefined) profileUpdates.specialty = updates.specialty
    if (updates.organizationId !== undefined) profileUpdates.organizationId = updates.organizationId

    if (Object.keys(profileUpdates).length > 0) {
      updateFields.profile = { ...(user.profile || {}), ...profileUpdates }
    }

    if (Object.keys(updateFields).length === 0) {
      return sendSuccess(res, {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile
        }
      })
    }

    const usersCol = db.collection('users')
    let filter
    try {
      filter = { _id: new (require('mongodb').ObjectId)(user.id) }
    } catch (e) {
      filter = { id: user.id }
    }

    await usersCol.updateOne(
      filter,
      { $set: { ...updateFields, updatedAt: new Date() } }
    )

    const updatedUser = await findById(user.id)
    if (!updatedUser) {
      return sendError(res, 500, 'Failed to retrieve updated user')
    }

    return sendSuccess(res, {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        profile: updatedUser.profile
      }
    })
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Update profile error:`, err)
    return sendError(res, 500, 'Failed to update profile', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

/**
 * @route POST /api/auth/logout
 * @desc Logout user (client-side token removal)
 */
router.post('/logout', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Logout request`)
  
  // Logout is primarily client-side (token removal)
  // This endpoint is for any server-side cleanup if needed
  console.log(`[Auth] [${requestId}] Logout successful`)
  return sendSuccess(res, { message: 'Logout successful', ok: true })
})

/**
 * @route POST /api/auth/google
 * @desc Google OAuth login
 */
router.post('/google', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Google login attempt`)
  
  try {
    const { credential, pin, setPinForFuture } = req.body || {}
    
    if (!credential) {
      return sendError(res, 400, 'Google credential is required')
    }

    console.log(`[Auth] [${requestId}] Verifying Google credential...`)
    
    // Fetch token info from Google
    const https = require('https')
    const payload = await new Promise((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      https.get(url, (gres) => {
        let raw = ''
        gres.on('data', (chunk) => raw += chunk)
        gres.on('end', () => {
          if (gres.statusCode !== 200) {
            return reject(new Error(`Google API error: ${gres.statusCode}`))
          }
          try {
            const j = JSON.parse(raw)
            resolve(j)
          } catch (e) {
            reject(e)
          }
        })
      }).on('error', (err) => reject(err))
    })

    const g = payload || {}
    const email = g.email
    const emailVerified = g.email_verified === 'true' || g.email_verified === true
    
    if (!email) {
      return sendError(res, 401, 'Email not provided by Google')
    }
    
    if (!emailVerified) {
      return sendError(res, 401, 'Email not verified by Google')
    }

    console.log(`[Auth] [${requestId}] Google credential verified for:`, email)

    const db = await getDb()
    let usersCol = null
    if (db) usersCol = db.collection('users')

    // Try to find existing user
    let userDoc = null
    if (usersCol) {
      userDoc = await usersCol.findOne({ email })
    } else {
      const found = await findByEmail(email)
      if (found) {
        userDoc = { _id: found.id, email: found.email, role: found.role, profile: found.profile }
      }
    }

    // Check for existing PIN
    const bcrypt = require('bcryptjs')
    const savedHash = userDoc?.profile?.googlePinHash || null

    if (userDoc) {
      console.log(`[Auth] [${requestId}] Existing user found:`, email)
      
      // PIN required for existing users
      if (!pin) {
        console.log(`[Auth] [${requestId}] PIN required for existing user`)
        return sendSuccess(res, { needPin: true, hasPin: !!savedHash })
      }

      // Verify PIN if it exists
      if (savedHash) {
        console.log(`[Auth] [${requestId}] Verifying existing PIN...`)
        const isValidPin = await bcrypt.compare(String(pin), String(savedHash))
        
        if (!isValidPin) {
          console.warn(`[Auth] [${requestId}] Invalid PIN for user:`, email)
          return sendError(res, 401, 'Invalid PIN')
        }

        console.log(`[Auth] [${requestId}] PIN verified, generating token...`)
        const userObj = {
          id: String(userDoc._id || userDoc.id),
          email: userDoc.email,
          role: userDoc.role
        }
        const token = signToken(userObj)
        
        return sendSuccess(res, {
          token,
          user: {
            id: userObj.id,
            email: userObj.email,
            role: userObj.role,
            profile: userDoc.profile
          }
        })
      }

      // No saved PIN yet - require pin + setPinForFuture
      if (!setPinForFuture) {
        return sendError(res, 400, 'PIN required to enable Google sign-in for this account. Please set a PIN.')
      }

      console.log(`[Auth] [${requestId}] Creating new PIN for user...`)
      const salt = await bcrypt.genSalt(10)
      const hash = await bcrypt.hash(String(pin), salt)

      try {
        if (usersCol) {
          await usersCol.updateOne(
            { email },
            { $set: { 'profile.googlePinHash': hash, 'profile.googleSub': g.sub } }
          )
          
          const updated = await usersCol.findOne({ email })
          const userObj = {
            id: String(updated._id),
            email: updated.email,
            role: updated.role
          }
          const token = signToken(userObj)

          return sendSuccess(res, {
            token,
            user: {
              id: userObj.id,
              email: userObj.email,
              role: userObj.role,
              profile: updated.profile
            }
          })
        }
      } catch (e) {
        console.error(`[Auth] [${requestId}] Failed to save Google PIN:`, e)
        return sendError(res, 500, 'Failed to save PIN')
      }
    }

    // New user - create account
    console.log(`[Auth] [${requestId}] New user, creating account:`, email)
    
    if (!pin || !setPinForFuture) {
      return sendError(res, 400, 'PIN required to create account via Google. Please set a PIN.')
    }

    try {
      const randomPassword = Math.random().toString(36).slice(2, 12)
      const profile = {
        name: g.name || '',
        picture: g.picture || '',
        googleSub: g.sub || ''
      }
      
      const newUser = await createUser({
        email,
        password: randomPassword,
        role: 'doctor',
        profile
      })

      console.log(`[Auth] [${requestId}] User created:`, newUser.id)

      // Store hashed PIN
      const salt = await bcrypt.genSalt(10)
      const hash = await bcrypt.hash(String(pin), salt)
      
      if (usersCol) {
        let filter = { email }
        try {
          filter = { _id: new (require('mongodb').ObjectId)(newUser.id) }
        } catch (e) {
          filter = { email }
        }

        await usersCol.updateOne(filter, {
          $set: { 'profile.googlePinHash': hash }
        })

        const created = await usersCol.findOne(filter)
        const userObj = {
          id: String(created._id),
          email: created.email,
          role: created.role
        }
        const token = signToken(userObj)

        return sendSuccess(res, {
          token,
          user: {
            id: userObj.id,
            email: userObj.email,
            role: userObj.role,
            profile: created.profile
          }
        }, 201)
      }
    } catch (err) {
      console.error(`[Auth] [${requestId}] Create Google user failed:`, err)
      return sendError(res, 500, 'Failed to create user')
    }

    return sendError(res, 500, 'Unable to complete Google sign-in')
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Google sign-in error:`, err)
    return sendError(res, 500, 'Google sign-in failed. Please try again.', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

/**
 * @route POST /api/auth/forgot-password
 * @desc Send password reset OTP
 */
router.post('/forgot-password', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Forgot password request`)
  
  try {
    const { email } = req.body || {}
    
    if (!email) {
      return sendError(res, 400, 'Email is required')
    }

    const user = await findByEmail(email)
    if (!user) {
      console.warn(`[Auth] [${requestId}] Password reset requested for non-existent email:`, email)
      // Return success to prevent email enumeration
      return sendSuccess(res, { message: 'If the email exists, a reset link has been sent' })
    }

    console.log(`[Auth] [${requestId}] Generating OTP for:`, email)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const db = await getDb()
    if (db) {
      await db.collection('password_resets').insertOne({
        email,
        otp,
        expiresAt: otpExpiry,
        createdAt: new Date(),
        used: false
      })
    }

    // Send email with OTP
    try {
      const nodemailer = require('nodemailer')
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      })

      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@healthsync.com',
        to: email,
        subject: 'HealthSync - Password Reset OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0ea5e9;">HealthSync Password Reset</h2>
            <p>You requested to reset your password. Use the following OTP to proceed:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #0ea5e9; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">This is an automated message from HealthSync. Please do not reply to this email.</p>
          </div>
        `
      }

      await transporter.sendMail(mailOptions)
      console.log(`[Auth] [${requestId}] OTP sent to ${email}: ${otp}`)
    } catch (emailError) {
      console.error(`[Auth] [${requestId}] Failed to send email:`, emailError)
      // Don't fail the request if email fails
    }

    return sendSuccess(res, {
      message: 'If the email exists, an OTP has been sent. Please check your inbox.'
    })
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Forgot password error:`, err)
    return sendError(res, 500, 'Failed to process password reset request', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using OTP
 */
router.post('/reset-password', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  console.log(`[Auth] [${requestId}] Password reset attempt`)
  
  try {
    const { email, otp, newPassword } = req.body || {}
    
    const validation = validateRequestBody(req.body, ['email', 'otp', 'newPassword'])
    if (!validation.valid) {
      return sendError(res, 400, validation.error)
    }

    const db = await getDb()
    if (!db) {
      return sendError(res, 503, 'Database unavailable')
    }

    // Find valid OTP
    const resetRequest = await db.collection('password_resets').findOne({
      email,
      otp,
      used: false,
      expiresAt: { $gt: new Date() }
    })

    if (!resetRequest) {
      console.warn(`[Auth] [${requestId}] Invalid or expired OTP for:`, email)
      return sendError(res, 400, 'Invalid or expired OTP')
    }

    console.log(`[Auth] [${requestId}] Valid OTP found for:`, email)
    
    // Get user
    const user = await findByEmail(email)
    if (!user) {
      console.error(`[Auth] [${requestId}] User not found during password reset:`, email)
      return sendError(res, 404, 'User not found')
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10)
    
    // Update password
    await db.collection('users').updateOne(
      { email },
      { $set: { passwordHash, updatedAt: new Date() } }
    )

    // Mark OTP as used
    await db.collection('password_resets').updateOne(
      { _id: resetRequest._id },
      { $set: { used: true, usedAt: new Date() } }
    )

    console.log(`[Auth] [${requestId}] Password reset successful for:`, email)
    
    return sendSuccess(res, {
      message: 'Password reset successful. You can now login with your new password.'
    })
    
  } catch (err) {
    console.error(`[Auth] [${requestId}] Reset password error:`, err)
    return sendError(res, 500, 'Failed to reset password', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
})

module.exports = router