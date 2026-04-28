const express = require('express')
const router = express.Router()

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const EDGAR_BASE = 'https://www.sec.gov'          // archives live on www, not data
const EDGAR_DATA = 'https://data.sec.gov'          // JSON APIs live here
const EDGAR_HEADERS = {
  'User-Agent': 'MarketAnalyzer contact@example.com',
  'Accept': 'application/json',
}
const EDGAR_HTML_HEADERS = {
  'User-Agent': 'MarketAnalyzer contact@example.com',
  'Accept': 'text/html,application/xhtml+xml,*/*',
}

// ---------------------------------------------------------------------------
// GET /api/markets/sec/:ticker
// All-in-one: ticker → cleaned 10-K text, proxied through server to avoid CORS
// ---------------------------------------------------------------------------

router.get('/sec/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase()

    // Step 1: resolve ticker → CIK via company_tickers map
    const mapRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: EDGAR_HEADERS,
    })
    if (!mapRes.ok) throw new Error('Could not fetch SEC ticker map')
    const map = await mapRes.json()

    const entry = Object.values(map).find(e => e.ticker.toUpperCase() === ticker)
    if (!entry) throw new Error(`Ticker "${ticker}" not found on SEC EDGAR`)

    const cik = String(entry.cik_str).padStart(10, '0')
    const companyName = entry.title
    const cikInt = parseInt(cik)
    console.log(`[sec] ${ticker} → CIK: ${cik} (${companyName})`)

    // Step 2: use submissions API to find the most recent 10-K
    const submissionsUrl = `${EDGAR_DATA}/submissions/CIK${cik}.json`
    console.log('[sec] Fetching submissions:', submissionsUrl)
    const subRes = await fetch(submissionsUrl, { headers: EDGAR_HEADERS })
    if (!subRes.ok) throw new Error(`Could not fetch submissions (${subRes.status})`)
    const subData = await subRes.json()

    const filings = subData.filings?.recent
    if (!filings) throw new Error('No filings data in submissions response')

    const tenKIndex = (filings.form || []).findIndex(f => f === '10-K')
    if (tenKIndex === -1) throw new Error(`No 10-K found for ${ticker}`)

    const accessionRaw  = filings.accessionNumber[tenKIndex]      // "0000320193-24-000123"
    const filingDate    = filings.filingDate[tenKIndex]
    const primaryDoc    = filings.primaryDocument[tenKIndex]       // "aapl-20240928.htm"
    const accessionClean = accessionRaw.replace(/-/g, '')          // "000032019324000123"

    console.log(`[sec] Most recent 10-K: ${accessionRaw} (${filingDate}) — ${primaryDoc}`)

    // Step 3: fetch the primary document from www.sec.gov/Archives
    const docUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikInt}/${accessionClean}/${primaryDoc}`
    console.log('[sec] Fetching doc:', docUrl)

    let html = null
    const docRes = await fetch(docUrl, { headers: EDGAR_HTML_HEADERS })

    if (docRes.ok) {
      html = await docRes.text()
      console.log('[sec] Direct doc fetch succeeded')
    } else {
      console.warn(`[sec] Direct doc fetch failed (${docRes.status}), trying filing index…`)

      // Fallback: fetch the filing index and pick the best .htm document
      const indexUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikInt}/${accessionClean}/`
      console.log('[sec] Fetching index:', indexUrl)
      const indexRes = await fetch(indexUrl, { headers: EDGAR_HTML_HEADERS })
      if (!indexRes.ok) throw new Error(`Could not fetch filing index (${indexRes.status})`)

      const indexHtml = await indexRes.text()
      const hrefMatches = [...indexHtml.matchAll(/href="([^"]*\.htm[l]?)"/gi)]
      const candidates = hrefMatches
        .map(m => m[1])
        .filter(h => !/\/R\d+\.htm/i.test(h) && !h.includes('-index'))
        .map(h => {
          if (h.startsWith('http')) return h
          if (h.startsWith('/')) return `${EDGAR_BASE}${h}`
          return `${EDGAR_BASE}/Archives/edgar/data/${cikInt}/${accessionClean}/${h}`
        })

      console.log('[sec] Candidate docs:', candidates.slice(0, 5))
      if (!candidates.length) throw new Error('No .htm documents found in filing index')

      const preferred =
        candidates.find(u => u.toLowerCase().includes(ticker.toLowerCase())) || candidates[0]

      const fallbackRes = await fetch(preferred, { headers: EDGAR_HTML_HEADERS })
      if (!fallbackRes.ok)
        throw new Error(`Could not download fallback 10-K document (${fallbackRes.status})`)

      html = await fallbackRes.text()
      console.log('[sec] Fetched fallback doc:', preferred)
    }

    if (!html) throw new Error('Failed to retrieve 10-K document')

    const text = extractTextFromHtml(html)
    res.json({ ticker, name: companyName, cik, filingDate, docUrl, text })
  } catch (err) {
    console.error('[sec]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Strip HTML tags and extract key 10-K sections for revenue analysis
function extractTextFromHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .trim()

  // Pull Item 1 (Business) and Item 7 (MD&A) — together these have all segment/revenue data
  // Keep total under ~24 000 chars (~6 000 tokens) to leave room for the prompt + response
  const sectionPatterns = [
    { label: 'BUSINESS', pattern: /item\s+1[^a-z]*business/i,           maxChars: 8000 },
    { label: 'MD&A',     pattern: /item\s+7[^a-z]*management.{0,40}discussion/i, maxChars: 14000 },
  ]

  const sections = []
  for (let i = 0; i < sectionPatterns.length; i++) {
    const { label, pattern, maxChars } = sectionPatterns[i]
    const match = text.match(pattern)
    if (!match) continue

    const start = match.index
    let end = start + maxChars
    // Don't bleed into the next section
    const nextPattern = sectionPatterns[i + 1]?.pattern
    if (nextPattern) {
      const nextMatch = text.slice(start + 500).match(nextPattern)
      if (nextMatch) end = Math.min(end, start + 500 + nextMatch.index)
    }
    sections.push(`=== ${label} ===\n` + text.slice(start, end))
  }

  // Fallback: first 20 000 chars if no sections matched
  if (sections.length === 0) return text.slice(0, 20000)

  return sections.join('\n\n')
}


// ---------------------------------------------------------------------------
// Shared Groq helper
// ---------------------------------------------------------------------------

async function groqChat(messages, { temperature = 0.2, maxTokens = 4096 } = {}) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is not set in your .env file')

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

function parseGroqJson(raw) {
  // Strip all leading/trailing markdown fences regardless of language tag
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```[\w]*\n?/m, '').replace(/```\s*$/m, '').trim()
  // If the model wrapped output in multiple fences, strip again
  cleaned = cleaned.replace(/^```[\w]*\n?/m, '').replace(/```\s*$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    // Last resort: find the first { or [ and parse from there
    const start = cleaned.search(/[\[{]/)
    if (start === -1) throw new Error('No JSON object found in model response')
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (end === -1) throw new Error('Unterminated JSON in model response')
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

// ---------------------------------------------------------------------------
// POST /api/markets/extract-tree
// ---------------------------------------------------------------------------

router.post('/extract-tree', async (req, res) => {
  try {
    const { ticker, companyName, tenKText } = req.body
    if (!ticker || !companyName || !tenKText) {
      return res.status(400).json({ error: 'ticker, companyName and tenKText are required' })
    }

    const systemPrompt = `You are a financial analyst specialized in supply chain mapping and revenue decomposition.
Your job is to extract a structured dependency tree from SEC 10-K filings.
You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.`

    const userPrompt = `Analyze this 10-K filing for ${companyName} (${ticker}) and extract a dependency tree.

The tree should follow this structure:
{
  "id": "root",
  "name": "${companyName}",
  "ticker": "${ticker}",
  "type": "company",
  "description": "brief company description",
  "children": [
    {
      "id": "seg_1",
      "name": "Segment/Revenue Stream Name",
      "type": "segment",
      "revenueShare": "52%",
      "description": "what this segment does",
      "children": [
        {
          "id": "inp_1_1",
          "name": "Key Input/Dependency Name",
          "type": "input",
          "description": "what this input is and why it matters",
          "commodity": true,
          "geographicRisk": "e.g. China-dependent",
          "children": [
            {
              "id": "sub_1_1_1",
              "name": "Sub-dependency",
              "type": "input",
              "description": "...",
              "commodity": false,
              "relatedTickers": ["TSMC", "AMAT"],
              "children": []
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Include ALL revenue segments/product lines reported in the filing — do not omit any
- For Apple this means iPhone, Mac, iPad, Wearables/Home/Accessories, AND Services
- revenueShare must be populated for every segment using actual figures from the filing
- Go at least 5 levels deep (company → segment → input → sub-input → sub-input → sub-input)
- Mark commodity:true for raw materials, metals, energy, agricultural products
- Include relatedTickers (other public companies) where relevant
- Include geographicRisk where a dependency is concentrated in one region
- Be specific and factual based on the filing text — do NOT summarize or drop segments
- Return ONLY the JSON object, nothing else

10-K TEXT:
${tenKText}`

    const raw = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 2048 })

    const tree = parseGroqJson(raw)
    res.json(tree)
  } catch (err) {
    console.error('[extract-tree]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/markets/exposed-companies
// ---------------------------------------------------------------------------

router.post('/exposed-companies', async (req, res) => {
  try {
    const { nodeName, nodeDescription } = req.body
    if (!nodeName || !nodeDescription) {
      return res.status(400).json({ error: 'nodeName and nodeDescription are required' })
    }

    const systemPrompt = `You are a financial analyst. Respond ONLY with valid JSON, no explanation.`

    const userPrompt = `Which publicly traded companies (preferably S&P 500) are most exposed to: "${nodeName}"?
Context: ${nodeDescription}

Return JSON in this exact format:
{
  "companies": [
    {
      "ticker": "XYZ",
      "name": "Company Name",
      "exposure": "high|medium|low",
      "reason": "one sentence explaining how they are exposed",
      "direction": "positive|negative|mixed",
      "directionReason": "does this input going up help or hurt them?"
    }
  ]
}

Include 5-8 companies. Return ONLY JSON.`

    const raw = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const result = parseGroqJson(raw)
    res.json(result)
  } catch (err) {
    console.error('[exposed-companies]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/markets/analyze-news
// ---------------------------------------------------------------------------

function summarizeTree(node, depth = 0) {
  if (depth > 3) return null
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    children: (node.children || [])
      .map(c => summarizeTree(c, depth + 1))
      .filter(Boolean),
  }
}

router.post('/analyze-news', async (req, res) => {
  try {
    const { articleText, tree } = req.body
    if (!articleText || !tree) {
      return res.status(400).json({ error: 'articleText and tree are required' })
    }

    const systemPrompt = `You are a financial analyst specializing in supply chain impact analysis. Respond ONLY with valid JSON.`

    const userPrompt = `Analyze this news article and identify which nodes in the provided dependency tree are affected.

ARTICLE:
${articleText}

DEPENDENCY TREE (summarized node names):
${JSON.stringify(summarizeTree(tree), null, 2)}

Return JSON:
{
  "summary": "2-3 sentence summary of the key event",
  "affectedNodes": [
    {
      "nodeId": "id from tree",
      "nodeName": "name from tree",
      "impact": "positive|negative|neutral",
      "magnitude": "high|medium|low",
      "reasoning": "why this node is affected"
    }
  ],
  "historicalAnalogs": [
    {
      "event": "name of historical analog event",
      "year": 2008,
      "outcome": "what happened to affected companies",
      "relevance": "why this is analogous"
    }
  ],
  "watchlist": [
    {
      "ticker": "ABC",
      "name": "Company Name",
      "action": "monitor|buy-signal|sell-signal",
      "reasoning": "why"
    }
  ]
}

Return ONLY JSON.`

    const raw = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 2048 })

    const result = parseGroqJson(raw)
    res.json(result)
  } catch (err) {
    console.error('[analyze-news]', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router