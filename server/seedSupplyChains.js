/**
 * seedSupplyChains.js
 *
 * One-shot bulk builder for S&P 500 supply chain trees.
 * Run with:  node seedSupplyChains.js
 *
 * Features:
 *  - Skips tickers already stored with an up-to-date filing date
 *  - Concurrency-limited (default 3 at a time) to respect SEC rate limits
 *  - Saves progress to seed-progress.json so you can resume after a crash
 *  - Prints a summary table when done
 */

require('dotenv').config()
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const SupplyChainTree = require('./models/SupplyChainTree.js')  // adjust path as needed

const API = import.meta.env.VITE_API_URL

// ─── S&P 500 tickers ─────────────────────────────────────────────────────────
// Full list — update periodically as index composition changes
const SP500 = ["MMM", "ABT", "ABBV", "ADBE", "AMD", "AFL",  "AOS", "A",'ACN','AES','A','APD','ABNB',
  'AKAM','ALB','ARE','ALGN','ALLE','LNT','ALL','GOOGL','GOOG','MO','AMZN',
  'AMCR','AEE','AAL','AEP','AXP','AIG','AMT','AWK','AMP','AME','AMGN','APH',
  'ADI','ANSS','AON','APA','AAPL','AMAT','APTV','ACGL','ADM','ANET','AJG',
  'AIZ','T','ATO','ADSK','ADP','AZO','AVB','AVY','AXON','BKR','BALL','BAC',
  'BK','BBWI','BAX','BDX','BRK.B','BBY','BIO','TECH','BIIB','BLK','BX','BA',
  'BCH','BSX','BMY','AVGO','BR','BRO','BF.B','BLDR','BG','CDNS','CZR','CPT',
  'CPB','COF','CAH','KMX','CCL','CARR','CTLT','CAT','CBOE','CBRE','CDW','CE',
  'COR','CNC','CNX','CDAY','CF','CRL','SCHW','CHTR','CVX','CMG','CB','CHD',
  'CI','CINF','CTAS','CSCO','C','CFG','CLX','CME','CMS','KO','CTSH','CL',
  'CMCSA','CAG','COP','ED','STZ','CEG','COO','CPRT','GLW','CPAY','CTVA','CSGP',
  'COST','CTRA','CRWD','CCI','CSX','CMI','CVS','DHR','DRI','DVA','DAY','DECK',
  'DE','DAL','DVN','DXCM','FANG','DLR','DFS','DG','DLTR','D','DPZ','DOV',
  'DOW','DHI','DTE','DUK','DD','EMN','ETN','EBAY','ECL','EIX','EW','EA','ELV',
  'LLY','EMR','ENPH','ETR','EOG','EPAM','EQT','EFX','EQIX','EQR','ESS','EL',
  'ETSY','EG','EVRG','ES','EXC','EXPE','EXPD','EXR','XOM','FFIV','FDS','FICO',
  'FAST','FRT','FDX','FIS','FITB','FSLR','FE','FI','FLT','FMC','F','FTNT',
  'FTV','FOXA','FOX','BEN','FCX','GRMN','IT','GE','GEHC','GEV','GEN','GNRC',
  'GD','GIS','GM','GPC','GILD','GPN','GL','GDDY','GS','HAL','HIG','HAS','HCA',
  'DOC','HSIC','HSY','HES','HPE','HLT','HOLX','HD','HON','HRL','HST','HWM',
  'HPQ','HUBB','HUM','HBAN','HII','IBM','IEX','IDXX','ITW','INCY','IR','PODD',
  'INTC','ICE','IFF','IP','IPG','INTU','ISRG','IVZ','INVH','IQV','IRM','JBHT',
  'JBL','JKHY','J','JNJ','JCI','JPM','JNPR','K','KVUE','KDP','KEY','KEYS',
  'KMB','KIM','KMI','KKR','KLAC','KHC','KR','LHX','LH','LRCX','LW','LVS',
  'LDOS','LEN','LIN','LYV','LKQ','LMT','L','LOW','LULU','LYB','MTB','MRO',
  'MPC','MKTX','MAR','MMC','MLM','MAS','MA','MTCH','MKC','MCD','MCK','MDT',
  'MRK','META','MET','MTD','MGM','MCHP','MU','MSFT','MAA','MRNA','MHK','MOH',
  'TAP','MDLZ','MPWR','MNST','MCO','MS','MOS','MSI','MSCI','NDAQ','NTAP',
  'NFLX','NEM','NWSA','NWS','NEE','NKE','NI','NDSN','NSC','NTRS','NOC','NCLH',
  'NRG','NUE','NVR','NVDA','NVO','ORLY','OXY','ODFL','OMC','ON','OKE','ORCL',
  'OTIS','OGN','OC','PCAR','PKG','PLTR','PH','PARA','PD','PAYX','PAYC','PYPL',
  'PNR','PEP','PFE','PCG','PM','PSX','PNW','PNC','POOL','PPG','PPL','PFG',
  'PG','PGR','PLD','PRU','PEG','PTC','PSA','PHM','QRVO','PWR','QCOM','DGX',
  'RL','RJF','RTX','O','REG','REGN','RF','RSG','RMD','RVTY','ROK','ROL','ROP',
  'ROST','RCL','SPGI','CRM','SBAC','SLB','STX','SRE','NOW','SHW','SPG','SWKS',
  'SJM','SW','SNA','SOLV','SO','LUV','SWK','SBUX','STT','STLD','STE','SYK',
  'SMCI','SYF','SNPS','SYY','TMUS','TROW','TTWO','TPR','TRGP','TGT','TEL',
  'TDY','TFX','TER','TSLA','TXN','TXT','TMO','TJX','TSCO','TT','TDG','TRV',
  'TRMB','TFC','TYL','TSN','USB','UBER','UDR','UHS','UNP','UAL','UPS','URI',
  'UNH','UHS','VLO','VTR','VRSN','VRSK','VZ','VRTX','VLTO','VMC','WRB','GWW',
  'WAB','WBA','WMT','DIS','WBD','WM','WAT','WEC','WFC','WELL','WST','WDC',
  'WRK','WY','WHR','WMB','WTW','WYNN','XEL','XYL','YUM','ZBRA','ZBH','ZTS',
]

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENCY    = 1      // parallel tickers at once — SEC allows ~10 req/s
const DELAY_MS       = 30000   // ms between batches
const PROGRESS_FILE  = path.join(__dirname, 'seed-progress.json')
const API_BASE       = process.env.API_BASE || `${API}/api/markets`

// ─── Progress tracking ────────────────────────────────────────────────────────
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
  } catch {
    return { done: [], failed: [] }
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ─── Core: fetch + build + upsert one ticker ─────────────────────────────────
async function processOneTicker(ticker) {
  console.log(`[seed] Processing ${ticker}…`)

  // 1. Fetch SEC data (reuses your existing /api/markets/sec/:ticker route)
  const secRes = await fetch(`${API_BASE}/sec/${ticker}`)
  if (!secRes.ok) {
    const err = await secRes.json()
    throw new Error(err.error || `SEC fetch failed (${secRes.status})`)
  }
  const { name, cik, filingDate, docUrl, text } = await secRes.json()

  // 2. Check if we already have a tree for this filing date — skip if current
  const existing = await SupplyChainTree.findOne({ ticker })
  if (existing && existing.filingDate === filingDate) {
    console.log(`[seed] ${ticker} already up to date (${filingDate}), skipping`)
    return 'skipped'
  }

  // 3. Build the dependency tree via Groq
  const treeRes = await fetch(`${API_BASE}/extract-tree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, companyName: name, tenKText: text }),
  })
  if (!treeRes.ok) {
    const err = await treeRes.json()
    throw new Error(err.error || `extract-tree failed (${treeRes.status})`)
  }
  const tree = await treeRes.json()

  // 4. Flatten the tree for cross-company search
  const flatNodes = SupplyChainTree.flattenTree(tree)

  // 5. Upsert into MongoDB
  await SupplyChainTree.findOneAndUpdate(
    { ticker },
    { ticker, companyName: name, cik, filingDate, docUrl, tree, flatNodes, updatedAt: new Date() },
    { upsert: true, new: true }
  )

  console.log(`[seed] ✓ ${ticker} saved (${flatNodes.length} nodes, filing ${filingDate})`)
  return 'saved'
}

// ─── Batch runner with concurrency limit ─────────────────────────────────────
async function runBatch(tickers, progress) {
  const results = { saved: 0, skipped: 0, failed: 0 }

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ticker => {
      try {
        const result = await processOneTicker(ticker)
        if (result === 'saved') results.saved++
        else results.skipped++
        progress.done.push(ticker)
        saveProgress(progress)
      } catch (err) {
        console.error(`[seed] ✗ ${ticker}: ${err.message}`)
        results.failed++
        progress.failed.push({ ticker, error: err.message })
        saveProgress(progress)
      }
    }))

    if (i + CONCURRENCY < tickers.length) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  return results
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('[seed] Connected to MongoDB')

  const progress = loadProgress()
  const doneTickers = new Set(progress.done)

  // Filter to tickers not yet successfully processed
  const remaining = SP500.filter(t => !doneTickers.has(t))
  console.log(`[seed] ${SP500.length} total | ${doneTickers.size} done | ${remaining.length} remaining`)

  if (remaining.length === 0) {
    console.log('[seed] All tickers already processed!')
    process.exit(0)
  }

  const results = await runBatch(remaining, progress)

  console.log('\n[seed] ═══════════ SUMMARY ═══════════')
  console.log(`  Saved:   ${results.saved}`)
  console.log(`  Skipped: ${results.skipped} (already current)`)
  console.log(`  Failed:  ${results.failed}`)
  if (progress.failed.length > 0) {
    console.log('\n  Failed tickers:')
    progress.failed.forEach(f => console.log(`    ${f.ticker}: ${f.error}`))
  }
  console.log('[seed] ══════════════════════════════════')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('[seed] Fatal:', err)
  process.exit(1)
})