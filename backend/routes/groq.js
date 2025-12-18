const express = require('express')
const router = express.Router()

router.post('/disease-info', async (req, res) => {
  try {
    const { icdCode, diseaseName } = req.body

    if (!diseaseName && !icdCode) {
      return res.status(400).json({ error: 'Disease name or ICD code is required' })
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY
    
    const prompt = `You are a medical information system. Provide comprehensive, accurate medical information about the following disease in a structured format.

Disease: ${diseaseName || 'Unknown'}
ICD-11 Code: ${icdCode || 'Not provided'}

Please provide the following information in JSON format:
{
  "title": "Full medical name of the disease",
  "definition": "A concise 2-3 sentence definition of the disease",
  "longDefinition": "A detailed explanation of the disease (4-6 sentences)",
  "synonyms": ["alternative name 1", "alternative name 2", ...],
  "symptoms": ["symptom 1", "symptom 2", "symptom 3", ...],
  "causes": ["cause 1", "cause 2", ...],
  "riskFactors": ["risk factor 1", "risk factor 2", ...],
  "diagnosis": ["diagnostic method 1", "diagnostic method 2", ...],
  "treatment": ["treatment option 1", "treatment option 2", ...],
  "prevention": ["prevention method 1", "prevention method 2", ...],
  "prognosis": "Expected outcome and long-term outlook",
  "complications": ["complication 1", "complication 2", ...],
  "prevalence": "Information about how common the disease is",
  "clinicalNotes": ["important clinical note 1", "important clinical note 2", ...]
}

Provide accurate, evidence-based medical information. Be comprehensive but concise. Return ONLY the JSON object, no additional text.`

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.2,
          max_tokens: 2048,
          top_p: 0.95
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API error:', errorText)
      return res.status(response.status).json({ error: 'Failed to generate disease information' })
    }

    const data = await response.json()
    const generatedText = data.choices?.[0]?.message?.content || ''

    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = generatedText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '')
    }

    try {
      const diseaseInfo = JSON.parse(jsonText)
      return res.json({ success: true, data: diseaseInfo })
    } catch (parseError) {
      console.error('Failed to parse Groq response:', parseError)
      console.error('Response text:', generatedText)
      return res.status(500).json({ 
        error: 'Failed to parse AI response',
        rawResponse: generatedText
      })
    }

  } catch (err) {
    console.error('Groq API error:', err)
    return res.status(500).json({ error: 'Failed to generate disease information' })
  }
})

router.post('/research-papers', async (req, res) => {
  try {
    const { query } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const SERPAPI_KEY = process.env.SERPAPI_KEY
    
    if (!SERPAPI_KEY) {
      return res.status(500).json({ error: 'SerpAPI key not configured' })
    }

    const url = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=100`
    
    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SerpAPI error:', errorText)
      return res.status(response.status).json({ error: 'Failed to fetch research papers' })
    }
    const data = await response.json()
    console.log(data);
    
    const papers = (data.organic_results || []).map(paper => ({
      title: paper.title,
      link: paper.link,
      snippet: paper.snippet,
      publication: paper.publication_info?.summary || '',
      citedBy: paper.inline_links?.cited_by?.total || 0,
      authors: paper.publication_info?.authors || [],
      year: paper.publication_info?.summary?.match(/\d{4}/) ? paper.publication_info.summary.match(/\d{4}/)[0] : ''
    }))

    return res.json({ success: true, papers })

  } catch (err) {
    console.error('Research papers API error:', err)
    return res.status(500).json({ error: 'Failed to fetch research papers' })
  }
})

module.exports = router
