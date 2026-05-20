/**
 * seedSupplyChains.js
 *
 * Runs directly against MongoDB + SEC + Groq — bypasses the HTTP server entirely
 * so auth middleware is never involved.
 *
 * Run with:  node seedSupplyChains.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const fs       = require('fs')
const path     = require('path')
const SupplyChainTree = require('./models/SupplyChainTree.js')

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENCY   = 1       // keep at 1 to avoid Groq TPM limits
const DELAY_MS      = 8000    // wait between tickers (8s) — adjust to your Groq tier
const PROGRESS_FILE = path.join(__dirname, 'seed-progress.json')

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'llama-3.3-70b-versatile'

const EDGAR_DATA    = 'https://data.sec.gov'
const EDGAR_BASE    = 'https://www.sec.gov'
const EDGAR_HEADERS = { 'User-Agent': 'MarketAnalyzer contact@example.com', 'Accept': 'application/json' }
const EDGAR_HTML    = { 'User-Agent': 'MarketAnalyzer contact@example.com', 'Accept': 'text/html,application/xhtml+xml,*/*' }

// ─── S&P 500 tickers ─────────────────────────────────────────────────────────
const SP500 = [
  'MMM','AOS','ABT','ABBV','ACN','ADBE','AMD','AES','AFL','A','APD','ABNB',
  'AKAM','ALB','ARE','ALGN','ALLE','LNT','ALL','GOOGL','GOOG','MO','AMZN',
  'AMCR','AEE','AAL','AEP','AXP','AIG','AMT','AWK','AMP','AME','AMGN','APH',
  'ADI','ANSS','AON','APA','AAPL','AMAT','APTV','ACGL','ADM','ANET','AJG',
  'AIZ','T','ATO','ADSK','ADP','AZO','AVB','AVY','AXON','BKR','BALL','BAC',
  'BK','BBWI','BAX','BDX','BBY','BIO','BIIB','BLK','BX','BA','BSX','BMY',
  'AVGO','BR','BRO','BG','CDNS','CZR','CPT','CPB','COF','CAH','KMX','CCL',
  'CARR','CAT','CBOE','CBRE','CDW','CE','COR','CNC','CF','CRL','SCHW','CHTR',
  'CVX','CMG','CB','CHD','CI','CINF','CTAS','CSCO','C','CFG','CLX','CME',
  'CMS','KO','CTSH','CL','CMCSA','CAG','COP','ED','STZ','CEG','COO','CPRT',
  'GLW','CPAY','CTVA','COST','CTRA','CRWD','CCI','CSX','CMI','CVS','DHR',
  'DRI','DVA','DECK','DE','DAL','DVN','DXCM','DLR','DFS','DG','DLTR','D',
  'DPZ','DOV','DOW','DHI','DTE','DUK','DD','EMN','ETN','EBAY','ECL','EIX',
  'EW','EA','ELV','LLY','EMR','ENPH','ETR','EOG','EQT','EFX','EQIX','EQR',
  'ESS','EL','ETSY','EG','EVRG','ES','EXC','EXPE','EXPD','EXR','XOM','FFIV',
  'FDS','FICO','FAST','FRT','FDX','FIS','FITB','FSLR','FE','FI','FLT','FMC',
  'F','FTNT','FTV','FOXA','FOX','BEN','FCX','GRMN','IT','GE','GEHC','GEN',
  'GNRC','GD','GIS','GM','GPC','GILD','GPN','GL','GDDY','GS','HAL','HIG',
  'HAS','HCA','HSIC','HSY','HES','HPE','HLT','HOLX','HD','HON','HRL','HST',
  'HWM','HPQ','HUBB','HUM','HBAN','HII','IBM','IEX','IDXX','ITW','INCY','IR',
  'PODD','INTC','ICE','IFF','IP','IPG','INTU','ISRG','IVZ','INVH','IQV','IRM',
  'JBHT','JBL','JKHY','J','JNJ','JCI','JPM','JNPR','K','KVUE','KDP','KEY',
  'KEYS','KMB','KIM','KMI','KKR','KLAC','KHC','KR','LHX','LH','LRCX','LW',
  'LVS','LDOS','LEN','LIN','LYV','LKQ','LMT','L','LOW','LULU','LYB','MTB',
  'MRO','MPC','MKTX','MAR','MMC','MLM','MAS','MA','MTCH','MKC','MCD','MCK',
  'MDT','MRK','META','MET','MTD','MGM','MCHP','MU','MSFT','MAA','MRNA','MHK',
  'MOH','TAP','MDLZ','MPWR','MNST','MCO','MS','MOS','MSI','MSCI','NDAQ',
  'NTAP','NFLX','NEM','NWSA','NWS','NEE','NKE','NI','NDSN','NSC','NTRS','NOC',
  'NCLH','NRG','NUE','NVR','NVDA','ORLY','OXY','ODFL','OMC','ON','OKE','ORCL',
  'OTIS','OGN','OC','PCAR','PKG','PLTR','PH','PARA','PAYX','PAYC','PYPL','PNR',
  'PEP','PFE','PCG','PM','PSX','PNW','PNC','POOL','PPG','PPL','PFG','PG','PGR',
  'PLD','PRU','PEG','PTC','PSA','PHM','PWR','QCOM','DGX','RL','RJF','RTX','O',
  'REG','REGN','RF','RSG','RMD','RVTY','ROK','ROL','ROP','ROST','RCL','SPGI',
  'CRM','SBAC','SLB','STX','SRE','NOW','SHW','SPG','SWKS','SJM','SNA','SOLV',
  'SO','LUV','SWK','SBUX','STT','STLD','STE','SYK','SYF','SNPS','SYY','TMUS',
  'TROW','TTWO','TPR','TRGP','TGT','TEL','TDY','TFX','TER','TSLA','TXN','TXT',
  'TMO','TJX','TSCO','TT','TDG','TRV','TRMB','TFC','TYL','TSN','USB','UBER',
  'UDR','UHS','UNP','UAL','UPS','URI','UNH','VLO','VTR','VRSN','VRSK','VZ',
  'VRTX','VMC','WRB','GWW','WAB','WBA','WMT','DIS','WM','WAT','WEC','WFC',
  'WELL','WST','WDC','WY','WHR','WMB','WTW','WYNN','XEL','XYL','YUM','ZBRA',
  'ZBH','ZTS',
]

// ─── Progress tracking ────────────────────────────────────────────────────────
function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) }
  catch { return { done: [], failed: [] } }
}
function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

// ─── SEC helpers (copied from markets.js — no HTTP involved) ─────────────────
async function resolveCik(ticker) {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: EDGAR_HEADERS })
  if (!res.ok) throw new Error('Could not fetch SEC ticker map')
  const map = await res.json()
  const entry = Object.values(map).find(e => e.ticker.toUpperCase() === ticker)
  if (!entry) throw new Error(`Ticker "${ticker}" not found on SEC EDGAR`)
  return { cik: String(entry.cik_str).padStart(10, '0'), companyName: entry.title }
}

async function getLatest10KMeta(cik, ticker) {
  const res = await fetch(`${EDGAR_DATA}/submissions/CIK${cik}.json`, { headers: EDGAR_HEADERS })
  if (!res.ok) throw new Error(`Submissions fetch failed (${res.status})`)
  const data = await res.json()
  const filings = data.filings?.recent
  const idx = (filings?.form || []).findIndex(f => f === '10-K')
  if (idx === -1) throw new Error(`No 10-K found for ${ticker}`)
  return {
    filingDate:     filings.filingDate[idx],
    primaryDoc:     filings.primaryDocument[idx],
    accessionClean: filings.accessionNumber[idx].replace(/-/g, ''),
    cikInt:         parseInt(cik),
  }
}

function extractTextFromHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ').replace(/\s{3,}/g, '\n\n').trim()

  const patterns = [
    { label: 'BUSINESS', pattern: /item\s+1[^a-z]*business/i,                      maxChars: 8000  },
    { label: 'MD&A',     pattern: /item\s+7[^a-z]*management.{0,40}discussion/i,   maxChars: 14000 },
  ]
  const sections = []
  for (let i = 0; i < patterns.length; i++) {
    const { label, pattern, maxChars } = patterns[i]
    const match = text.match(pattern)
    if (!match) continue
    const start = match.index
    let end = start + maxChars
    const next = patterns[i + 1]?.pattern
    if (next) {
      const nm = text.slice(start + 500).match(next)
      if (nm) end = Math.min(end, start + 500 + nm.index)
    }
    sections.push(`=== ${label} ===\n` + text.slice(start, end))
  }
  return sections.length ? sections.join('\n\n') : text.slice(0, 20000)
}

// ─── Groq helpers ─────────────────────────────────────────────────────────────
function parseGroqJson(raw) {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```[\w]*\n?/m, '').replace(/```\s*$/m, '').trim()
  cleaned = cleaned.replace(/^```[\w]*\n?/m, '').replace(/```\s*$/m, '').trim()
  try { return JSON.parse(cleaned) } catch {
    const start = cleaned.search(/[\[{]/)
    const end   = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (start === -1 || end === -1) throw new Error('No JSON in Groq response')
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

async function groqChat(messages, { maxTokens = 2048 } = {}) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2, max_tokens: maxTokens }),
  })
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function buildTree(ticker, companyName, tenKText) {
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
  niobium mining (Brazil 80% global supply) + liquid helium cooling (Qatar/US) + gradient copper
  windings + RF amplifiers + rare earth shim magnets → neodymium/dysprosium sourcing (China 90%)
- 10-K says "semiconductors" → YOU expand: photolithography → EUV machines (ASML monopoly) →
  photoresist (JSR/Shin-Etsu Japan) → ultra-pure water → CMP slurries → rare earth dopants
- 10-K says "abrasives" → YOU expand: aluminum oxide → bauxite mining → Bayer process →
  calcination → China export controls on processed alumina

This tree is used to detect indirect exposure to news events. If a news article mentions
"helium shortage", the system must find it under MRI machines in the tree without the
article saying the company name at all. The leaf nodes must contain real physical/chemical inputs.

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
- Leaf node names must be GRANULAR: "neodymium oxide", "niobium-titanium wire", "liquid helium",
  "ASML EUV lithography", "NAND 3D TLC flash", "China rare earth processing",
  "Bayer process alumina", "photoresist Japan supply", "palladium Russia supply"
- commodity:true for raw materials, metals, chemicals, gases, agricultural products
- geographicRisk: specific country + reason
- relatedTickers: direct suppliers or key players
- Return ONLY the JSON object, nothing else

10-K TEXT (use for segment identification — expand supply chain from your own knowledge):
${tenKText}`

  const raw = await groqChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { maxTokens: 2048 }
  )
  return parseGroqJson(raw)
}

// ─── Process one ticker ───────────────────────────────────────────────────────
async function processOneTicker(ticker) {
  console.log(`[seed] Processing ${ticker}…`)

  // 1. Resolve CIK
  const { cik, companyName } = await resolveCik(ticker)
  const cikInt = parseInt(cik)

  // 2. Get latest 10-K metadata
  const { filingDate, primaryDoc, accessionClean } = await getLatest10KMeta(cik, ticker)

  // 3. Skip if already up to date
  const existing = await SupplyChainTree.findOne({ ticker })
  if (existing && existing.filingDate === filingDate) {
    console.log(`[seed] ${ticker} already current (${filingDate}), skipping`)
    return 'skipped'
  }

  // 4. Fetch and parse the 10-K
  const docUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikInt}/${accessionClean}/${primaryDoc}`
  const docRes = await fetch(docUrl, { headers: EDGAR_HTML })
  if (!docRes.ok) throw new Error(`10-K fetch failed (${docRes.status})`)
  const html = await docRes.text()
  const text = extractTextFromHtml(html)

  // 5. Build tree with Groq
  const tree = await buildTree(ticker, companyName, text)

  // 6. Flatten + upsert
  const flatNodes = SupplyChainTree.flattenTree(tree)
  await SupplyChainTree.findOneAndUpdate(
    { ticker },
    { ticker, companyName, cik, filingDate, docUrl, tree, flatNodes, updatedAt: new Date() },
    { upsert: true, new: true }
  )

  console.log(`[seed] ✓ ${ticker} — ${flatNodes.length} nodes (filing ${filingDate})`)
  return 'saved'
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('[seed] Connected to MongoDB')

  const progress   = loadProgress()
  const done       = new Set(progress.done)
  const remaining  = SP500.filter(t => !done.has(t))

  console.log(`[seed] ${SP500.length} total | ${done.size} done | ${remaining.length} remaining`)
  if (!remaining.length) { console.log('[seed] All done!'); process.exit(0) }

  const results = { saved: 0, skipped: 0, failed: 0 }

  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ticker => {
      try {
        const r = await processOneTicker(ticker)
        results[r]++
        progress.done.push(ticker)
      } catch (err) {
        console.error(`[seed] ✗ ${ticker}: ${err.message}`)
        results.failed++
        progress.failed.push({ ticker, error: err.message })
      }
      saveProgress(progress)
    }))

    if (i + CONCURRENCY < remaining.length) {
      console.log(`[seed] Waiting ${DELAY_MS / 1000}s before next batch…`)
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log('\n[seed] ══════════ SUMMARY ══════════')
  console.log(`  Saved:   ${results.saved}`)
  console.log(`  Skipped: ${results.skipped}`)
  console.log(`  Failed:  ${results.failed}`)
  if (progress.failed.length)
    progress.failed.forEach(f => console.error(`  ✗ ${f.ticker}: ${f.error}`))
  console.log('[seed] ════════════════════════════════')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => { console.error('[seed] Fatal:', err); process.exit(1) })