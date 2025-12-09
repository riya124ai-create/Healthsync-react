const express = require('express')
const jwt = require('jsonwebtoken')
const getDb = require('../lib/mongo')
const { ObjectId } = require('mongodb')
const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

function getTokenFromReq(req) {
  const auth = req.get('authorization')
  if (auth && auth.startsWith('Bearer ')) return auth.split(' ')[1]
  return null
}

router.post('/', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })

    let data
    try {
      data = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ error: 'invalid token' })
    }

  const body = req.body || {}
  const { name, age, icd11, disease } = body
  if (!name || !age || !icd11) return res.status(400).json({ error: 'name, age and icd11 required' })

    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const patients = db.collection('patients')
  const doc = { name, age: Number(age), icd11, ...(disease ? { disease: String(disease) } : {}), createdBy: data.id || data.email || null, createdAt: new Date() }
    const r = await patients.insertOne(doc)
    return res.status(201).json({ id: String(r.insertedId), ...doc })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('patients POST error', err)
    return res.status(500).json({ error: 'failed to create patient' })
  }
})

// GET /api/diagnosis - return ALL diagnosis created by the requester (must be before /api/patients/:id)
router.get('/diagnosis', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }

    const requester = data.id || data.email || null
    if (!requester) return res.status(401).json({ error: 'invalid requester' })

    const db = await getDb()
    if (!db) return res.status(503).json({ diagnosis: [] })

    // Find ALL patients that have diagnosis created by this doctor
    const cursor = db.collection('patients').find(
      { 'diagnosis.createdBy': requester },
      { projection: { name: 1, age: 1, diagnosis: 1, createdBy: 1, createdAt: 1 } }
    )
    const results = await cursor.toArray()
    const list = []
    for (const p of results) {
      const pid = String(p._id)
      const pname = p.name || ''
      const diags = Array.isArray(p.diagnosis) ? p.diagnosis : []
      // Only include diagnosis created by this doctor
      for (const d of diags) {
        if (d.createdBy === requester) {
          list.push({
            patientId: pid,
            patientName: pname,
            patient: {
              id: pid,
              name: p.name,
              age: p.age,
              createdBy: p.createdBy,
              createdAt: p.createdAt
            },
            id: d.id || String(d._id || ''),
            icd11: d.icd11 || null,
            disease: d.disease || null,
            notes: d.notes || null,
            createdAt: d.createdAt || null,
            createdBy: d.createdBy || null
          })
        }
      }
    }
    // sort most recent first
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    return res.json({ diagnosis: list })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetch diagnosis error', err)
    return res.status(500).json({ error: 'failed to fetch diagnosis' })
  }
})

router.get('/', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }
    
    const requester = data.id || data.email || null
    if (!requester) return res.status(401).json({ error: 'invalid requester' })

    const db = await getDb()
    if (!db) return res.status(503).json({ patients: [] })

    // Only return patients created by this user (assigned to them)
    const docs = await db.collection('patients').find({ createdBy: requester }).sort({ createdAt: -1 }).limit(50).toArray()
    const patients = docs.map(d => ({ id: String(d._id), name: d.name, age: d.age, icd11: d.icd11, disease: d.disease, createdAt: d.createdAt, createdBy: d.createdBy, assignedAt: d.assignedAt }))
    return res.json({ patients })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('patients GET error', err)
    return res.status(500).json({ error: 'failed to fetch patients' })
  }
})

// update patient (only creator)
router.put('/:id', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }

    const id = req.params.id
    const body = req.body || {}
    const update = {}
    if (body.name) update.name = body.name
    if (body.age) update.age = Number(body.age)
    if (body.icd11) update.icd11 = body.icd11
    if (body.disease) update.disease = String(body.disease)
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'nothing to update' })

    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const patients = db.collection('patients')
    const existing = await patients.findOne({ _id: new ObjectId(id) })
    if (!existing) return res.status(404).json({ error: 'not found' })
    const owner = existing.createdBy || null
    const requester = data.id || data.email || null
    if (owner && requester && owner !== requester) return res.status(403).json({ error: 'forbidden' })

    await patients.updateOne({ _id: new ObjectId(id) }, { $set: { ...update, updatedAt: new Date() } })
    const doc = await patients.findOne({ _id: new ObjectId(id) })
    return res.json({ id: String(doc._id), name: doc.name, age: doc.age, icd11: doc.icd11, disease: doc.disease, createdAt: doc.createdAt, createdBy: doc.createdBy })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('patients PUT error', err)
    return res.status(500).json({ error: 'failed to update patient' })
  }
})

// delete patient (only creator)
router.delete('/:id', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }

    const id = req.params.id
    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })
    const patients = db.collection('patients')
    const existing = await patients.findOne({ _id: new ObjectId(id) })
    if (!existing) return res.status(404).json({ error: 'not found' })
    const owner = existing.createdBy || null
    const requester = data.id || data.email || null
    if (owner && requester && owner !== requester) return res.status(403).json({ error: 'forbidden' })

    await patients.deleteOne({ _id: new ObjectId(id) })
    return res.json({ ok: true })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('patients DELETE error', err)
    return res.status(500).json({ error: 'failed to delete patient' })
  }
})

router.post('/:id/diagnosis', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }

    const id = req.params.id
    const body = req.body || {}
    const { icd11, disease, notes } = body
    if (!notes || String(notes).trim() === '') return res.status(400).json({ error: 'notes (text diagnosis) required' })

    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })
    const patients = db.collection('patients')
    const existing = await patients.findOne({ _id: new ObjectId(id) })
    if (!existing) return res.status(404).json({ error: 'not found' })
    const owner = existing.createdBy || null
    const requester = data.id || data.email || null
    if (owner && requester && owner !== requester) return res.status(403).json({ error: 'forbidden' })

    const diag = { id: String(new ObjectId()), icd11: icd11 || null, disease: disease ? String(disease) : null, notes: notes ? String(notes) : null, createdAt: new Date(), createdBy: requester }
    
    
    await patients.updateOne({ _id: new ObjectId(id) }, { 
      $push: { diagnosis: diag }, 
      $set: { assignedAt: null, updatedAt: new Date() } 
    })
    
    try {
      await db.collection('notifications').deleteOne({
        userId: requester,
        type: 'patient-assigned',
        'data.patientId': id
      })
      console.log(`Deleted patient assignment notification for patient ${id}`)
    } catch (notifErr) {
      console.error('Error deleting notification:', notifErr)
    }
    
    try {
      const io = req.app.get('io')
      const userSockets = req.app.get('userSockets')
      
      if (io && userSockets) {
        const doctorSocketId = userSockets.get(String(requester))
        
        if (doctorSocketId) {
          io.to(doctorSocketId).emit('patient:diagnosis-added', {
            patientId: id,
            diagnosisId: diag.id
          })
          console.log(`Emitted diagnosis-added event to doctor ${requester}`)
        }
      }
    } catch (socketErr) {
      console.error('Socket event error:', socketErr)
    }
    
    return res.status(201).json({ diagnosis: diag })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('add diagnosis error', err)
    return res.status(500).json({ error: 'failed to add diagnosis' })
  }
})

// GET /api/patients/:id/diagnosis - get diagnosis for a specific patient
router.get('/:id/diagnosis', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }

    const id = req.params.id
    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const patients = db.collection('patients')
    const doc = await patients.findOne({ _id: new ObjectId(id) })
    if (!doc) return res.status(404).json({ error: 'patient not found' })

    const diagnosis = Array.isArray(doc.diagnosis) ? doc.diagnosis : []
    return res.json({ diagnosis })
  } catch (err) {
    console.error('fetch patient diagnosis error', err)
    return res.status(500).json({ error: 'failed to fetch diagnosis' })
  }
})

// GET /api/patients/:id - get a single patient by ID
router.get('/:id', async (req, res) => {
  try {
    const token = getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'missing token' })
    let data
    try { data = jwt.verify(token, JWT_SECRET) } catch (err) { return res.status(401).json({ error: 'invalid token' }) }

    const id = req.params.id
    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const patients = db.collection('patients')
    const doc = await patients.findOne({ _id: new ObjectId(id) })
    if (!doc) return res.status(404).json({ error: 'patient not found' })

    const patient = {
      id: String(doc._id),
      name: doc.name,
      age: doc.age,
      icd11: doc.icd11,
      disease: doc.disease,
      createdAt: doc.createdAt,
      assignedAt: doc.assignedAt,
      createdBy: doc.createdBy
    }
    return res.json({ patient })
  } catch (err) {
    console.error('patient GET by ID error', err)
    return res.status(500).json({ error: 'failed to fetch patient' })
  }
})

module.exports = router
