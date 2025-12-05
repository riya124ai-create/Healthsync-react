const express = require('express')
const getDb = require('../lib/mongo')

const router = express.Router()

const seedOrgs = [
  { name: 'Community Clinic A', slug: 'community-clinic-a' },
  { name: 'General Hospital B', slug: 'general-hospital-b' },
  { name: 'Independent Practice C', slug: 'independent-practice-c' },
]

router.get('/', async (req, res) => {
  try {
    const db = await getDb()
    if (!db) return res.json({ organizations: seedOrgs.map((o, i) => ({ id: `org-${i + 1}`, name: o.name })) })

    const col = db.collection('organizations')
    const count = await col.countDocuments()
    if (count === 0) {
      await col.insertMany(seedOrgs.map(o => ({ name: o.name, slug: o.slug, createdAt: new Date() })))
    }

    const docs = await col.find().toArray()
    const organizations = docs.map(d => ({ id: String(d._id), name: d.name }))
    return res.json({ organizations })
  } catch (err) {
    console.error('organizations GET error', err)
    return res.json({ organizations: seedOrgs.map((o, i) => ({ id: `org-${i + 1}`, name: o.name })) })
  }
})

// GET /api/organizations/:id - return single organization
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const orgId = req.params.id
    const org = await db.collection('organizations').findOne({ _id: new (require('mongodb').ObjectId)(orgId) })
    if (!org) return res.status(404).json({ error: 'organization not found' })

    return res.json({ 
      id: String(org._id), 
      name: org.name, 
      slug: org.slug,
      admin: org.admin,
      createdAt: org.createdAt 
    })
  } catch (err) {
    console.error('organization GET by ID error', err)
    return res.status(500).json({ error: 'failed to load organization' })
  }
})

module.exports = router

// GET /api/organizations/:id/doctors - return doctors for an organization with their patients and diagnoses
router.get('/:id/doctors', async (req, res) => {
  try {
    const db = await getDb()
    if (!db) return res.status(503).json({ doctors: [] })

    const orgId = req.params.id
    const org = await db.collection('organizations').findOne({ _id: new (require('mongodb').ObjectId)(orgId) })
    if (!org) return res.status(404).json({ error: 'organization not found' })

    // auth: require admin
    const auth = req.get('authorization')
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' })
    const token = auth.split(' ')[1]
    let data
    try { data = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'change-this-secret') } catch (err) { return res.status(401).json({ error: 'invalid token' }) }
    const requesterId = data.id || null
    if (!requesterId) return res.status(401).json({ error: 'invalid requester' })
    if (String(org.admin) !== String(requesterId)) return res.status(403).json({ error: 'forbidden' })

    // find doctors (users) associated with this org
    const usersCol = db.collection('users')
    const docs = await usersCol.find({ 'profile.organizationId': String(orgId) }).toArray()
    const doctors = []
    const patientsCol = db.collection('patients')
    for (const d of docs.filter(doc => doc.role === 'doctor')) {
      const docId = String(d._id)
      const docEmail = d.email
      const patients = await patientsCol.find({ $or: [{ createdBy: docId }, { createdBy: docEmail }] }).toArray()
      const patientList = patients.map(p => ({ id: String(p._id), name: p.name, age: p.age, icd11: p.icd11, disease: p.disease, createdAt: p.createdAt }))
      // collect diagnoses authored by this doctor across patients
      const diagnoses = []
      for (const p of patients) {
        if (Array.isArray(p.diagnoses)) {
          for (const diag of p.diagnoses) {
            if (String(diag.createdBy) === docId || String(diag.createdBy) === docEmail) {
              diagnoses.push({ id: diag.id || String(new (require('mongodb').ObjectId)()), patientId: String(p._id), patientName: p.name || '', icd11: diag.icd11 || null, disease: diag.disease || null, notes: diag.notes || null, createdAt: diag.createdAt || null })
            }
          }
        }
      }

      doctors.push({ id: docId, email: docEmail, profile: d.profile || {}, patients: patientList, diagnoses })
    }

    return res.json({ 
      organization: {
        id: String(org._id),
        name: org.name,
        slug: org.slug
      },
      doctors 
    })
  } catch (err) {
    console.error('org doctors error', err)
    return res.status(500).json({ error: 'failed to load doctors' })
  }
})

  // GET /api/organizations/:id/unassigned - return patients created by org admin (not assigned to doctors)
  router.get('/:id/unassigned', async (req, res) => {
    try {
      const db = await getDb()
      if (!db) return res.status(503).json({ patients: [] })

      const orgId = req.params.id
      const org = await db.collection('organizations').findOne({ _id: new (require('mongodb').ObjectId)(orgId) })
      if (!org) return res.status(404).json({ error: 'organization not found' })

      // auth: require admin
      const auth = req.get('authorization')
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' })
      const token = auth.split(' ')[1]
      let data
      try { data = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'change-this-secret') } catch (err) { return res.status(401).json({ error: 'invalid token' }) }
      const requesterId = data.id || null
      if (!requesterId) return res.status(401).json({ error: 'invalid requester' })
      if (String(org.admin) !== String(requesterId)) return res.status(403).json({ error: 'forbidden' })

      const patientsCol = db.collection('patients')
      const docs = await patientsCol.find({ createdBy: requesterId }).sort({ createdAt: -1 }).limit(50).toArray()
      const patients = docs.map(d => ({ id: String(d._id), name: d.name, age: d.age, icd11: d.icd11, disease: d.disease, createdAt: d.createdAt }))
      return res.json({ patients })
    } catch (err) {
      console.error('org unassigned error', err)
      return res.status(500).json({ patients: [] })
    }
  })

// POST /api/organizations/:id/patients/:pid/assign - assign/transfer a patient to a doctor (org admin only)
router.post('/:id/patients/:pid/assign', async (req, res) => {
  try {
    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const orgId = req.params.id
    const pid = req.params.pid
    // auth: require admin
    const auth = req.get('authorization')
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' })
    const token = auth.split(' ')[1]
    let data
    try { data = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'change-this-secret') } catch (err) { return res.status(401).json({ error: 'invalid token' }) }
    const requesterId = data.id || null
    if (!requesterId) return res.status(401).json({ error: 'invalid requester' })

    const org = await db.collection('organizations').findOne({ _id: new (require('mongodb').ObjectId)(orgId) })
    if (!org) return res.status(404).json({ error: 'organization not found' })
    if (String(org.admin) !== String(requesterId)) return res.status(403).json({ error: 'forbidden' })

    const body = req.body || {}
    const { doctorId } = body
    if (!doctorId) return res.status(400).json({ error: 'doctorId required' })

    // verify doctor belongs to org
    const usersCol = db.collection('users')
    const doc = await usersCol.findOne({ _id: new (require('mongodb').ObjectId)(doctorId), 'profile.organizationId': String(orgId) })
    if (!doc) return res.status(404).json({ error: 'doctor not found in organization' })

    // update patient record: set createdBy to doctor id
    const patientsCol = db.collection('patients')
    const existing = await patientsCol.findOne({ _id: new (require('mongodb').ObjectId)(pid) })
    if (!existing) return res.status(404).json({ error: 'patient not found' })

    await patientsCol.updateOne({ _id: new (require('mongodb').ObjectId)(pid) }, { $set: { createdBy: String(doctorId), updatedAt: new Date() } })
    const updated = await patientsCol.findOne({ _id: new (require('mongodb').ObjectId)(pid) })
    return res.json({ ok: true, patient: { id: String(updated._id), name: updated.name, age: updated.age, createdBy: updated.createdBy } })
  } catch (err) {
    console.error('assign patient error', err)
    return res.status(500).json({ error: 'failed to assign patient' })
  }
})

// POST /api/organizations/:id/patients - create a patient as org admin (no disease/icd11 required)
router.post('/:id/patients', async (req, res) => {
  try {
    const db = await getDb()
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const orgId = req.params.id
    const org = await db.collection('organizations').findOne({ _id: new (require('mongodb').ObjectId)(orgId) })
    if (!org) return res.status(404).json({ error: 'organization not found' })

    // auth: require admin
    const auth = req.get('authorization')
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' })
    const token = auth.split(' ')[1]
    let data
    try { data = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'change-this-secret') } catch (err) { return res.status(401).json({ error: 'invalid token' }) }
    const requesterId = data.id || null
    if (!requesterId) return res.status(401).json({ error: 'invalid requester' })
    if (String(org.admin) !== String(requesterId)) return res.status(403).json({ error: 'forbidden' })

    const body = req.body || {}
    const name = body.name ? String(body.name).trim() : ''
    const age = body.age ? Number(body.age) : null
    if (!name || !age) return res.status(400).json({ error: 'name and age required' })

    const patientsCol = db.collection('patients')
    const doc = { name, age: Number(age), createdBy: requesterId, createdAt: new Date() }
    const r = await patientsCol.insertOne(doc)
    return res.status(201).json({ id: String(r.insertedId), ...doc })
  } catch (err) {
    console.error('org create patient error', err)
    return res.status(500).json({ error: 'failed to create patient' })
  }
})
