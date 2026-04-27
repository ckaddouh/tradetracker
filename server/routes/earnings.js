const express = require('express')
const router = express.Router()
const axios = require('axios')
const EarningsWatch = require('../models/EarningsWatch')
const verifyToken = require('../middleware/verifyToken')

const WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'INTC', 'CRM',
  'JPM', 'GS', 'MS', 'BAC', 'WFC', 'BLK', 'C', 'AXP', 'V', 'MA',
  'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'LLY', 'BMY', 'AMGN', 'GILD', 'CVS',
  'XOM', 'CVX', 'COP', 'SLB', 'OXY',
  'WMT', 'TGT', 'COST', 'MCD', 'SBUX', 'NKE', 'DIS', 'NFLX',
  'BA', 'CAT', 'GE', 'HON', 'UPS', 'FDX',
  'UBER', 'ABNB', 'SQ', 'PYPL', 'SHOP', 'SNAP', 'X', 'GME'
]

router.use(verifyToken)

// Formats a raw number string into a readable value like "$4.2B" or "$320M"
function formatRevenue(raw) {
  const n = parseFloat(raw)
  if (isNaN(n)) return null
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  return '$' + n.toLocaleString()
}

// GET /api/earnings/calendar
router.get('/calendar', async (req, res) => {
  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'EARNINGS_CALENDAR', horizon: '3month', apikey: process.env.ALPHA_VANTAGE_KEY },
      responseType: 'text'
    })
    const lines = response.data.trim().split('\n')
    if (lines.length < 2) return res.json([])
    const results = lines.slice(1)
      .map(line => {
        const fields = line.split(',')
        return { ticker: fields[0], name: fields[1], reportDate: fields[2], fiscalQuarter: fields[3], estimatedEPS: fields[4] }
      })
      .filter(item => WATCHLIST.includes(item.ticker))
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))
    res.json(results)
  } catch (error) {
    console.error('Calendar fetch error:', error.message)
    res.status(500).json({ error: 'Failed to fetch earnings calendar' })
  }
})

// GET /api/earnings/lookup/:ticker
router.get('/lookup/:ticker', async (req, res) => {
  const { ticker } = req.params
  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'EARNINGS_CALENDAR', symbol: ticker, horizon: '3month', apikey: process.env.ALPHA_VANTAGE_KEY },
      responseType: 'text'
    })
    const lines = response.data.trim().split('\n')
    if (lines.length < 2) return res.json({ reportDate: null })
    const match = lines.slice(1).find(line => line.startsWith(ticker + ','))
    if (!match) return res.json({ reportDate: null })
    const fields = match.split(',')
    res.json({ ticker, reportDate: fields[2] || null })
  } catch (error) {
    console.error('Alpha Vantage lookup error:', error.message)
    res.status(500).json({ error: 'Failed to fetch earnings date' })
  }
})

// GET /api/earnings/results/:ticker
router.get('/results/:ticker', async (req, res) => {
  const { ticker } = req.params
  try {
    const earningsRes = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'EARNINGS', symbol: ticker, apikey: process.env.ALPHA_VANTAGE_KEY }
    })
    const quarterlyReports = earningsRes.data.quarterlyEarnings || []
    if (!quarterlyReports.length) return res.json({ found: false })

    const latest = quarterlyReports[0]
    const reported = parseFloat(latest.reportedEPS)
    const estimated = parseFloat(latest.estimatedEPS)
    const surprisePct = parseFloat(latest.surprisePercentage)

    let result = 'inline'
    if (surprisePct > 2) result = 'beat'
    else if (surprisePct < -2) result = 'miss'

    res.json({
      found: true, result, ticker,
      fiscalDate: latest.fiscalDateEnding,
      epsActual: isNaN(reported) ? null : reported,
      epsEstimate: isNaN(estimated) ? null : estimated,
      surprisePct: isNaN(surprisePct) ? null : surprisePct,
    })
  } catch (error) {
    console.error('Results fetch error:', error.message)
    res.status(500).json({ error: 'Failed to fetch earnings results' })
  }
})

// GET /api/earnings/summarize/:ticker
// Fetches EPS + income statement + overview, then uses Groq/Llama for a rich summary
router.get('/summarize/:ticker', async (req, res) => {
  const { ticker } = req.params

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI summary is not configured (missing GROQ_API_KEY)' })
  }

  try {
    // Pull all three Alpha Vantage endpoints in parallel
    const [earningsRes, overviewRes, incomeRes] = await Promise.all([
      axios.get('https://www.alphavantage.co/query', {
        params: { function: 'EARNINGS', symbol: ticker, apikey: process.env.ALPHA_VANTAGE_KEY }
      }),
      axios.get('https://www.alphavantage.co/query', {
        params: { function: 'OVERVIEW', symbol: ticker, apikey: process.env.ALPHA_VANTAGE_KEY }
      }),
      axios.get('https://www.alphavantage.co/query', {
        params: { function: 'INCOME_STATEMENT', symbol: ticker, apikey: process.env.ALPHA_VANTAGE_KEY }
      })
    ])

    const overview = overviewRes.data
    const quarterlyEarnings = (earningsRes.data.quarterlyEarnings || []).slice(0, 4)
    const quarterlyIncome = (incomeRes.data.quarterlyReports || []).slice(0, 4)

    if (!quarterlyEarnings.length) {
      return res.status(404).json({ error: 'No earnings data found for this ticker' })
    }

    const latest = quarterlyEarnings[0]
    const prev = quarterlyEarnings[1]
    const prevYear = quarterlyEarnings[3] // same quarter last year for YoY

    // Match income statement to latest earnings quarter
    const latestIncome = quarterlyIncome[0] || {}
    const prevYearIncome = quarterlyIncome[3] || {}

    const revenue = formatRevenue(latestIncome.totalRevenue)
    const prevYearRevenue = formatRevenue(prevYearIncome.totalRevenue)
    const grossProfit = formatRevenue(latestIncome.grossProfit)
    const operatingIncome = formatRevenue(latestIncome.operatingIncome)
    const netIncome = formatRevenue(latestIncome.netIncome)
    const ebitda = formatRevenue(latestIncome.ebitda)

    // Compute YoY revenue growth if both values exist
    let revenueGrowthYoY = null
    if (latestIncome.totalRevenue && prevYearIncome.totalRevenue) {
      const curr = parseFloat(latestIncome.totalRevenue)
      const prior = parseFloat(prevYearIncome.totalRevenue)
      if (!isNaN(curr) && !isNaN(prior) && prior !== 0) {
        revenueGrowthYoY = (((curr - prior) / prior) * 100).toFixed(1) + '%'
      }
    }

    const prompt = `You are a senior financial analyst writing a concise but detailed earnings summary for traders and investors.

Ticker: ${ticker}
Company: ${overview.Name || ticker}
Sector: ${overview.Sector || 'N/A'} | Industry: ${overview.Industry || 'N/A'}
Market Cap: ${overview.MarketCapitalization ? formatRevenue(overview.MarketCapitalization) : 'N/A'}
Analyst Price Target: ${overview.AnalystTargetPrice ? '$' + overview.AnalystTargetPrice : 'N/A'}
P/E Ratio: ${overview.PERatio || 'N/A'} | Forward P/E: ${overview.ForwardPE || 'N/A'}
Profit Margin: ${overview.ProfitMargin || 'N/A'} | EPS (TTM): ${overview.EPS || 'N/A'}
52-Week High/Low: ${overview['52WeekHigh'] || 'N/A'} / ${overview['52WeekLow'] || 'N/A'}
Beta: ${overview.Beta || 'N/A'}
Dividend Yield: ${overview.DividendYield || 'N/A'}

--- MOST RECENT QUARTER (${latest.fiscalDateEnding}) ---
Reported EPS: ${latest.reportedEPS}
Estimated EPS: ${latest.estimatedEPS}
EPS Surprise: ${latest.surprise} (${latest.surprisePercentage}%)
Revenue: ${revenue || 'N/A'}
Gross Profit: ${grossProfit || 'N/A'}
Operating Income: ${operatingIncome || 'N/A'}
Net Income: ${netIncome || 'N/A'}
EBITDA: ${ebitda || 'N/A'}
Revenue YoY Growth: ${revenueGrowthYoY || 'N/A'}
Prev Year Same Quarter Revenue: ${prevYearRevenue || 'N/A'}

${prev ? `--- PREVIOUS QUARTER (${prev.fiscalDateEnding}) ---
Reported EPS: ${prev.reportedEPS}
Estimated EPS: ${prev.estimatedEPS}
EPS Surprise: ${prev.surprise} (${prev.surprisePercentage}%)` : ''}

${prevYear ? `--- SAME QUARTER LAST YEAR (${prevYear.fiscalDateEnding}) ---
Reported EPS: ${prevYear.reportedEPS}
Estimated EPS: ${prevYear.estimatedEPS}` : ''}

Write a rich, analyst-quality summary. Focus on what actually matters to a trader: revenue growth, margin trends, EPS vs estimates, and forward outlook. Be specific with numbers. Do not pad with generic statements.

Respond ONLY with a raw JSON object. No markdown, no code fences, no explanation:
{
  "verdict": "beat" or "miss" or "inline",
  "sentiment": "bullish" or "bearish" or "neutral",
  "headline": "2-3 sentence summary covering EPS beat/miss, revenue, and the single most important takeaway",
  "epsActual": <number>,
  "epsEstimate": <number>,
  "surprisePct": <number>,
  "revenue": "<formatted string e.g. $4.2B or null>",
  "revenueGrowthYoY": "<e.g. +29% or null>",
  "grossMargin": "<e.g. 42.1% or null>",
  "operatingIncome": "<formatted string or null>",
  "netIncome": "<formatted string or null>",
  "keyPoints": [
    "Specific point with a real number — e.g. Revenue of $X.XB, up Y% YoY",
    "EPS of $X.XX vs estimate of $X.XX, a Z% beat",
    "Margin/profitability insight with specific figures",
    "Forward-looking point: guidance, backlog, orders, or next catalyst",
    "Risk or notable concern worth watching"
  ],
  "analystTarget": "<price string or null>",
  "guidance": "<one sentence on what management said about forward guidance, or null>",
  "watchFor": "One specific, actionable sentence for traders on the key thing to monitor next"
}`

    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          {
            role: 'system',
            content: 'You are a senior financial analyst. Always respond with raw JSON only — no markdown, no code fences, no preamble. Be specific and use real numbers from the data provided.'
          },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const rawText = groqRes.data.choices[0].message.content.trim()
    const jsonText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const summary = JSON.parse(jsonText)

    res.json({ ticker, fiscalDate: latest.fiscalDateEnding, ...summary })
  } catch (error) {
    console.error('Earnings summarize error:', error.response?.data || error.message)
    res.status(500).json({ error: 'Failed to generate earnings summary' })
  }
})

// GET /api/earnings
router.get('/', async (req, res) => {
  try {
    const watches = await EarningsWatch.find({ userId: req.user.userId }).sort({ reportDate: 1 })
    res.json(watches)
  } catch (error) {
    console.error('Error fetching earnings:', error.message)
    res.status(500).json({ error: 'Failed to fetch earnings watches' })
  }
})

// POST /api/earnings
router.post('/', async (req, res) => {
  const { ticker, reportDate, view, notes } = req.body
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' })
  try {
    const existing = await EarningsWatch.findOne({ userId: req.user.userId, ticker })
    if (existing) return res.status(409).json({ error: 'Already watching this ticker' })
    const watch = await EarningsWatch.create({ userId: req.user.userId, ticker, reportDate, view, notes })
    res.status(201).json(watch)
  } catch (error) {
    console.error('Error creating earnings watch:', error.message)
    res.status(500).json({ error: 'Failed to add earnings watch' })
  }
})

// PATCH /api/earnings/:id
router.patch('/:id', async (req, res) => {
  try {
    const watch = await EarningsWatch.findOne({ _id: req.params.id, userId: req.user.userId })
    if (!watch) return res.status(404).json({ error: 'Earnings watch not found' })
    const allowedFields = ['view', 'actualMove', 'notes', 'result', 'reportDate', 'status']
    allowedFields.forEach(field => { if (req.body[field] !== undefined) watch[field] = req.body[field] })
    if (req.body.status === 'closed' && !watch.closedAt) watch.closedAt = new Date()
    await watch.save()
    res.json(watch)
  } catch (error) {
    console.error('Error updating earnings watch:', error.message)
    res.status(500).json({ error: 'Failed to update earnings watch' })
  }
})

// DELETE /api/earnings/:id
router.delete('/:id', async (req, res) => {
  try {
    const watch = await EarningsWatch.findOneAndDelete({ _id: req.params.id, userId: req.user.userId })
    if (!watch) return res.status(404).json({ error: 'Earnings watch not found' })
    res.json({ message: 'Deleted successfully' })
  } catch (error) {
    console.error('Error deleting earnings watch:', error.message)
    res.status(500).json({ error: 'Failed to delete earnings watch' })
  }
})

module.exports = router