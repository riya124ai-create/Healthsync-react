const express = require('express')
const fetch = globalThis.fetch || require('node-fetch')

const router = express.Router()


router.get('/search', async (req, res) => {
  try {
    const terms = req.query.terms || ''
    const maxList = req.query.maxList || '15'
    const url = `https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search?terms=${encodeURIComponent(String(terms))}&maxList=${encodeURIComponent(String(maxList))}`
    const resp = await fetch(url)
    if (!resp.ok) return res.status(resp.status).send(await resp.text())
    const data = await resp.json()
    return res.json(data)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('icd11 proxy error', err)
    return res.status(500).json({ error: 'icd11 proxy failed' })
  }
})

module.exports = router
