const express = require('express')
const router = express.Router()
const SupplyChainTree = require('../models/SupplyChainTree')  // adjust path if needed

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

    const systemPrompt = `You are a supply chain intelligence expert with deep knowledge of manufacturing 
processes, industrial chemistry, materials science, and geopolitics. You build exhaustive 
dependency trees that trace every product back to its raw materials, critical suppliers, and 
geopolitical chokepoints — going far beyond what any company discloses in its SEC filings.
You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.`

    const userPrompt = `You are building a deep supply chain dependency tree for ${companyName} (${ticker}).

Your job has TWO phases:

PHASE 1 — Read the 10-K to identify all revenue segments and the products/services in each.

PHASE 2 — For each product or service, use your own expert knowledge of how that product is
physically made to expand the tree downward into real-world components, materials, and suppliers.
Do NOT limit yourself to what the 10-K mentions about suppliers.

Examples of the depth required:
- 10-K says "MRI machines" → YOU expand: superconducting magnets → niobium-titanium wire →
  niobium mining (Brazil, 80% global supply) + liquid helium cooling (Qatar/US) + gradient copper
  windings + RF amplifiers + rare earth shim magnets → neodymium/dysprosium sourcing (China 90%)
- 10-K says "semiconductors" → YOU expand: photolithography → EUV machines (ASML monopoly) →
  photoresist (JSR/Shin-Etsu, Japan) → ultra-pure water → CMP slurries → rare earth dopants
- 10-K says "abrasives" → YOU expand: aluminum oxide → bauxite mining → Bayer process →
  calcination → China export controls on processed alumina

This tree is used to detect indirect exposure to news events. If a news article mentions
"helium shortage", the system must find it under MRI machines in Abbott's tree without the
article saying "Abbott" or "MRI". The leaf nodes must contain the real physical/chemical inputs.

Return JSON:
{
  "id": "root",
  "name": "${companyName}",
  "ticker": "${ticker}",
  "type": "company",
  "description": "brief company description",
  "children": [
    {
      "id": "seg_1",
      "name": "Segment Name",
      "type": "segment",
      "revenueShare": "34%",
      "description": "what this segment sells",
      "children": [
        {
          "id": "inp_1_1",
          "name": "Product or Major System",
          "type": "input",
          "description": "what this product is",
          "commodity": false,
          "geographicRisk": null,
          "relatedTickers": [],
          "children": [
            {
              "id": "inp_1_1_1",
              "name": "Physical Component or Subsystem",
              "type": "input",
              "description": "specific technical description",
              "commodity": false,
              "geographicRisk": "Japan-dependent",
              "relatedTickers": ["ASML"],
              "children": [
                {
                  "id": "inp_1_1_1_1",
                  "name": "Raw Material or Critical Supplier",
                  "type": "input",
                  "description": "e.g. niobium-titanium alloy wire, 80% sourced from CBMM Brazil",
                  "commodity": true,
                  "geographicRisk": "Brazil-dependent",
                  "relatedTickers": [],
                  "children": [
                    {
                      "id": "inp_1_1_1_1_1",
                      "name": "Upstream factor or geopolitical chokepoint",
                      "type": "input",
                      "description": "e.g. Brazilian niobium export policy, CBMM pricing power",
                      "commodity": true,
                      "geographicRisk": "Brazil-dependent",
                      "relatedTickers": [],
                      "children": []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- ALL revenue segments from the filing with actual revenueShare percentages
- Minimum 5 levels deep on every branch
- Depth-2 nodes (products): at least 3 children each
- Depth-3 nodes (components): at least 2 children each
- Depth-4 nodes (materials): at least 1 child
- Leaf node names must be GRANULAR and SEARCHABLE:
  "neodymium oxide", "niobium-titanium wire", "liquid helium", "borosilicate glass",
  "ASML EUV lithography", "NAND 3D TLC flash", "Taiwan Strait shipping", "China rare earth processing",
  "Bayer process alumina", "photoresist — Japan supply", "palladium — Russia supply"
- commodity:true for any raw material, metal, chemical, gas, agricultural product
- geographicRisk: specific country + reason (e.g. "China — 90% of rare earth oxide processing")
- relatedTickers: direct suppliers or key players at that node
- Return ONLY the JSON object, nothing else

10-K TEXT (use for segment identification — expand supply chain from your own knowledge):
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

// ---------------------------------------------------------------------------
// POST /api/markets/fetch-article
// Server-side URL fetcher so the frontend can load articles without CORS issues
// ---------------------------------------------------------------------------

router.post('/fetch-article', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'url is required' })

    const articleRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketAnalyzer/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
    })
    if (!articleRes.ok) throw new Error(`Could not fetch URL (${articleRes.status})`)

    const html = await articleRes.text()

    // Strip HTML and extract readable text
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim()
      .slice(0, 15000)

    res.json({ text, length: text.length })
  } catch (err) {
    console.error('[fetch-article]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/markets/cache-tree
// Called internally after extract-tree to persist a tree to MongoDB.
// Also called automatically by the /sec/:ticker route on fresh fetches.
// ---------------------------------------------------------------------------

router.post('/cache-tree', async (req, res) => {
  try {
    const { ticker, companyName, cik, filingDate, docUrl, tree } = req.body
    if (!ticker || !tree) {
      return res.status(400).json({ error: 'ticker and tree are required' })
    }

    const flatNodes = SupplyChainTree.flattenTree(tree)

    await SupplyChainTree.findOneAndUpdate(
      { ticker },
      { ticker, companyName, cik, filingDate, docUrl, tree, flatNodes, updatedAt: new Date() },
      { upsert: true, new: true }
    )

    console.log(`[cache-tree] Saved ${ticker} (${flatNodes.length} nodes)`)
    res.json({ ok: true, nodeCount: flatNodes.length })
  } catch (err) {
    console.error('[cache-tree]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/markets/tree/:ticker
// Return cached tree if available and up to date; otherwise build + cache it.
// ---------------------------------------------------------------------------

router.get('/tree/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase()

    // 1. Check SEC for the latest filing date (fast — just submissions JSON)
    const cik = await resolveCik(ticker)
    const { filingDate, primaryDoc, accessionClean, companyName, cikInt } = await getLatest10KMeta(cik, ticker)

    // 2. Check cache
    const cached = await SupplyChainTree.findOne({ ticker })
    if (cached && cached.filingDate === filingDate) {
      console.log(`[tree] Cache hit for ${ticker} (${filingDate})`)
      return res.json({ source: 'cache', tree: cached.tree, filingDate, companyName: cached.companyName })
    }

    // 3. Cache miss or stale — fetch, build, cache
    console.log(`[tree] Cache miss for ${ticker} — building…`)
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionClean}/${primaryDoc}`
    const docRes = await fetch(docUrl, { headers: EDGAR_HTML_HEADERS })
    if (!docRes.ok) throw new Error(`Could not fetch 10-K doc (${docRes.status})`)
    const html = await docRes.text()
    const text = extractTextFromHtml(html)

    const treeRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/markets/extract-tree`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, companyName, tenKText: text }),
    })
    if (!treeRes.ok) throw new Error('extract-tree failed')
    const tree = await treeRes.json()

    const flatNodes = SupplyChainTree.flattenTree(tree)
    await SupplyChainTree.findOneAndUpdate(
      { ticker },
      { ticker, companyName, cik, filingDate, docUrl, tree, flatNodes, updatedAt: new Date() },
      { upsert: true, new: true }
    )

    res.json({ source: 'fresh', tree, filingDate, companyName })
  } catch (err) {
    console.error('[tree]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/markets/analyze-news-global
// Full pipeline: article → extract concepts → search all stored trees → return
// affected companies with display paths showing HOW they're exposed
// ---------------------------------------------------------------------------

router.post('/analyze-news-global', async (req, res) => {
  try {
    const { articleText } = req.body
    if (!articleText) return res.status(400).json({ error: 'articleText is required' })

    // Step 1: Use Groq to extract granular supply chain concepts from the article.
    // We want SPECIFIC technical/commodity/geographic concepts, not broad themes.
    const extractSystemPrompt = `You are a supply chain analyst. Your job is to extract specific, 
searchable supply chain concepts from news articles. Think about raw materials, specific 
technologies, geographic chokepoints, specific companies as suppliers, manufacturing processes, 
and regulatory frameworks. Be SPECIFIC and GRANULAR — not "semiconductors" but "TSMC 3nm", 
not "trade war" but "rare earth export restrictions". Respond ONLY with valid JSON.`

    const extractUserPrompt = `Extract supply chain impact concepts from this news article.

For each concept, assess:
- How directly the article mentions it (direct vs implied)
- Whether it's positive or negative for companies that depend on it
- Specific search terms someone would use to find this in a supply chain tree

Return JSON:
{
  "articleSummary": "2-3 sentence summary of the core event",
  "impacts": [
    {
      "concept": "exact term to search in supply chain trees",
      "aliases": ["alternative search terms", "related terms"],
      "impact": "positive|negative|neutral",
      "magnitude": "high|medium|low",
      "reasoning": "why this concept is affected and how",
      "affectsUpstream": true,
      "affectsDownstream": true
    }
  ]
}

Be exhaustive — include 8-15 concepts covering commodities, geographies, technologies, 
specific companies mentioned, regulatory/policy changes, and logistics chokepoints.

ARTICLE:
${articleText}`

    console.log('[analyze-news-global] Extracting concepts from article…')
    const rawConcepts = await groqChat([
      { role: 'system', content: extractSystemPrompt },
      { role: 'user', content: extractUserPrompt },
    ], { maxTokens: 2048 })

    const conceptData = parseGroqJson(rawConcepts)
    const impacts = conceptData.impacts || []

    // Step 2: Build search terms — concept + all aliases
    const allSearchTerms = []
    for (const impact of impacts) {
      allSearchTerms.push(impact.concept)
      if (impact.aliases) allSearchTerms.push(...impact.aliases)
    }

    console.log(`[analyze-news-global] Searching ${allSearchTerms.length} terms across stored trees…`)

    // Step 3: Pull ALL flatNodes from the DB so Groq can reason over them
    const allDocs = await SupplyChainTree.find(
      {},
      { ticker: 1, companyName: 1, filingDate: 1, flatNodes: 1 }
    ).lean()

    // Build a compact node list for Groq to reason over
    // Format: "TICKER|nodeId|depth|name|description"
    const nodeLines = []
    for (const doc of allDocs) {
      for (const n of doc.flatNodes || []) {
        nodeLines.push(`${doc.ticker}|${n.id}|${n.depth}|${n.name}|${n.description || ''}`)
      }
    }

    console.log(`[analyze-news-global] Matching concepts against ${nodeLines.length} nodes across ${allDocs.length} companies…`)

    // Step 4: Ask Groq to match concepts against node names semantically
    const matchSystemPrompt = `You are a supply chain analyst. Given a list of supply chain impact 
concepts and a list of company supply chain nodes, identify which nodes are affected by each concept.
Use semantic reasoning — "NdFeB magnets" matches a node called "Permanent Magnets", 
"rare earth export ban" matches "Neodymium" or "China sourcing" or "Dysprosium".
Respond ONLY with valid JSON.`

    const matchUserPrompt = `Match these supply chain impact concepts against the company nodes below.

CONCEPTS:
${impacts.map((imp, i) => `${i}. [${imp.impact}/${imp.magnitude}] "${imp.concept}" — ${imp.reasoning}`).join('\n')}

COMPANY NODES (format: TICKER|nodeId|depth|nodeName|description):
${nodeLines.join('\n')}

Return JSON — only include nodes that are genuinely affected:
{
  "matches": [
    {
      "ticker": "MMM",
      "nodeId": "sub_1_1_1",
      "nodeName": "Aluminum Oxide",
      "conceptIndex": 2,
      "reasoning": "why this node is affected by that concept"
    }
  ]
}

Be thorough but precise. Return ONLY JSON.`

    const rawMatches = await groqChat([
      { role: 'system', content: matchSystemPrompt },
      { role: 'user', content: matchUserPrompt },
    ], { maxTokens: 2048 })

    const matchData = parseGroqJson(rawMatches)
    const matches = matchData.matches || []

    console.log(`[analyze-news-global] Groq found ${matches.length} node matches`)

    // Step 5: Hydrate matches with full node data from the DB docs
    const docByTicker = {}
    for (const doc of allDocs) docByTicker[doc.ticker] = doc

    const byTicker = {}
    for (const match of matches) {
      const doc = docByTicker[match.ticker]
      if (!doc) continue

      const node = (doc.flatNodes || []).find(n => n.id === match.nodeId)
      if (!node) continue

      const imp = impacts[match.conceptIndex]
      if (!imp) continue

      if (!byTicker[match.ticker]) {
        byTicker[match.ticker] = {
          ticker: match.ticker,
          companyName: doc.companyName,
          filingDate: doc.filingDate,
          exposures: [],
          overallImpact: 'neutral',
          maxDepth: 0,
        }
      }

      byTicker[match.ticker].exposures.push({
        matchedNode: node.name,
        displayPath: node.displayPath,
        depth: node.depth,
        concept: imp.concept,
        impact: imp.impact,
        magnitude: imp.magnitude,
        reasoning: match.reasoning,
        geographicRisk: node.geographicRisk || null,
        commodity: node.commodity || false,
        revenueShare: node.revenueShare || null,
      })

      if (imp.impact === 'negative') byTicker[match.ticker].overallImpact = 'negative'
      else if (imp.impact === 'positive' && byTicker[match.ticker].overallImpact === 'neutral') {
        byTicker[match.ticker].overallImpact = 'positive'
      }
      byTicker[match.ticker].maxDepth = Math.max(byTicker[match.ticker].maxDepth, node.depth)
    }

    // Step 5: Deduplicate exposures and sort companies
    const results = Object.values(byTicker)
      .map(company => ({
        ...company,
        // Remove duplicate exposures (same node matched by multiple aliases)
        exposures: company.exposures.filter(
          (e, i, arr) => arr.findIndex(x => x.matchedNode === e.matchedNode && x.concept === e.concept) === i
        ),
      }))
      .sort((a, b) => {
        // Sort by: negative impact first, then by max depth (most indirect = most surprising), then exposure count
        if (a.overallImpact !== b.overallImpact) {
          const order = { negative: 0, positive: 1, neutral: 2 }
          return order[a.overallImpact] - order[b.overallImpact]
        }
        return b.maxDepth - a.maxDepth || b.exposures.length - a.exposures.length
      })

    res.json({
      articleSummary: conceptData.articleSummary,
      conceptsExtracted: impacts,
      companiesAffected: results.length,
      results,
    })
  } catch (err) {
    console.error('[analyze-news-global]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/markets/impact-search
// Given a list of affected node concepts from news analysis, find every
// company in the DB whose tree contains a matching node — at any depth —
// and return the upward path for each match.
// ---------------------------------------------------------------------------

router.post('/impact-search', async (req, res) => {
  try {
    const { concepts } = req.body
    // concepts: array of strings from the news analysis affectedNodes, e.g.
    // ["x86 architecture", "NAND flash memory", "Taiwan manufacturing"]
    if (!concepts || !concepts.length) {
      return res.status(400).json({ error: 'concepts array is required' })
    }

    // Build a regex OR query across all concept strings
    const regexes = concepts.map(c => new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

    // Search flatNodes.name and flatNodes.description across all stored companies
    const matches = await SupplyChainTree.aggregate([
      // Unwind to get one doc per node
      { $unwind: '$flatNodes' },
      // Match nodes whose name or description matches any concept
      {
        $match: {
          $or: [
            { 'flatNodes.name': { $in: regexes } },
            { 'flatNodes.description': { $in: regexes } },
          ],
        },
      },
      // Project only what we need
      {
        $project: {
          _id: 0,
          ticker: 1,
          companyName: 1,
          filingDate: 1,
          matchedNode: '$flatNodes.name',
          matchedDescription: '$flatNodes.description',
          displayPath: '$flatNodes.displayPath',
          depth: '$flatNodes.depth',
          revenueShare: '$flatNodes.revenueShare',
          geographicRisk: '$flatNodes.geographicRisk',
          commodity: '$flatNodes.commodity',
        },
      },
      // Sort: deepest matches first (more specific), then alphabetically
      { $sort: { depth: -1, ticker: 1 } },
    ])

    // Group by ticker for a cleaner response
    const byTicker = {}
    for (const m of matches) {
      if (!byTicker[m.ticker]) {
        byTicker[m.ticker] = {
          ticker: m.ticker,
          companyName: m.companyName,
          filingDate: m.filingDate,
          exposures: [],
        }
      }
      byTicker[m.ticker].exposures.push({
        matchedNode: m.matchedNode,
        displayPath: m.displayPath,
        depth: m.depth,
        geographicRisk: m.geographicRisk || null,
        commodity: m.commodity || false,
      })
    }

    const results = Object.values(byTicker).sort((a, b) =>
      // Companies with more/deeper matches first
      b.exposures.length - a.exposures.length
    )

    res.json({ conceptsSearched: concepts, companiesFound: results.length, results })
  } catch (err) {
    console.error('[impact-search]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// Shared helpers for CIK resolution (used by /tree/:ticker)
// ---------------------------------------------------------------------------

async function resolveCik(ticker) {
  const mapRes = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: EDGAR_HEADERS })
  if (!mapRes.ok) throw new Error('Could not fetch SEC ticker map')
  const map = await mapRes.json()
  const entry = Object.values(map).find(e => e.ticker.toUpperCase() === ticker)
  if (!entry) throw new Error(`Ticker "${ticker}" not found on SEC EDGAR`)
  return String(entry.cik_str).padStart(10, '0')
}

async function getLatest10KMeta(cik, ticker) {
  const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_HEADERS })
  if (!subRes.ok) throw new Error(`Could not fetch submissions (${subRes.status})`)
  const subData = await subRes.json()
  const filings = subData.filings?.recent
  const tenKIndex = (filings?.form || []).findIndex(f => f === '10-K')
  if (tenKIndex === -1) throw new Error(`No 10-K found for ${ticker}`)
  return {
    filingDate: filings.filingDate[tenKIndex],
    primaryDoc: filings.primaryDocument[tenKIndex],
    accessionClean: filings.accessionNumber[tenKIndex].replace(/-/g, ''),
    companyName: subData.name,
    cikInt: parseInt(cik),
  }
}

module.exports = router

// DEBUG — remove after testing
router.get('/debug-all-nodes', async (req, res) => {
  const docs = await SupplyChainTree.find({}, { ticker: 1, 'flatNodes.name': 1, 'flatNodes.description': 1, 'flatNodes.depth': 1 })
  const result = {}
  for (const doc of docs) {
    result[doc.ticker] = doc.flatNodes.map(n => `[d${n.depth}] ${n.name}`)
  }
  res.json(result)
})