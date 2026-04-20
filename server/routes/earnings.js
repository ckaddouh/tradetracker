const express = require('express')
const router = express.Router()
const axios = require('axios')
const EarningsWatch = require('../models/EarningsWatch')
const verifyToken = require('../middleware/verifyToken')

// Curated list of high-profile tickers across sectors
const WATCHLIST = [
  // Mega cap tech
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'INTC', 'CRM',
  // Finance
  'JPM', 'GS', 'MS', 'BAC', 'WFC', 'BLK', 'C', 'AXP', 'V', 'MA',
  // Healthcare
  'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'LLY', 'BMY', 'AMGN', 'GILD', 'CVS',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'OXY',
  // Consumer
  'WMT', 'TGT', 'COST', 'MCD', 'SBUX', 'NKE', 'DIS', 'NFLX',
  // Industrial
  'BA', 'CAT', 'GE', 'HON', 'UPS', 'FDX',
  // Other
  'UBER', 'ABNB', 'SQ', 'PYPL', 'SHOP', 'SNAP', 'X', 'GME'
]

router.use(verifyToken)

// GET /api/earnings/calendar — fetch upcoming earnings filtered to curated list
router.get('/calendar', async (req, res) => {
  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'EARNINGS_CALENDAR',
        horizon: '3month',
        apikey: process.env.ALPHA_VANTAGE_KEY
      },
      responseType: 'text'
    })

    const lines = response.data.trim().split('\n')
    if (lines.length < 2) {
      return res.json([])
    }

    // Parse CSV and filter to curated list
    const results = lines.slice(1)
      .map(line => {
        const fields = line.split(',')
        return {
          ticker: fields[0],
          name: fields[1],
          reportDate: fields[2],
          fiscalQuarter: fields[3],
          estimatedEPS: fields[4],
        }
      })
      .filter(item => WATCHLIST.includes(item.ticker))
      .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))

    res.json(results)
  } catch (error) {
    console.error('Calendar fetch error:', error.message)
    res.status(500).json({ error: 'Failed to fetch earnings calendar' })
  }
})

// GET /api/earnings — get all watched earnings for logged-in user
router.get('/', async (req, res) => {
  try {
    const watches = await EarningsWatch.find({ userId: req.user.userId })
      .sort({ reportDate: 1 })
    res.json(watches)
  } catch (error) {
    console.error('Error fetching earnings:', error.message)
    res.status(500).json({ error: 'Failed to fetch earnings watches' })
  }
})

// GET /api/earnings/lookup/:ticker — fetch earnings date for a specific ticker
router.get('/lookup/:ticker', async (req, res) => {
  const { ticker } = req.params
  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'EARNINGS_CALENDAR',
        symbol: ticker,
        horizon: '3month',
        apikey: process.env.ALPHA_VANTAGE_KEY
      },
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

// POST /api/earnings — add a ticker to personal watchlist
router.post('/', async (req, res) => {
  const { ticker, reportDate, view, notes } = req.body

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker is required' })
  }

  try {
    // Check if already watching this ticker
    const existing = await EarningsWatch.findOne({ userId: req.user.userId, ticker })
    if (existing) {
      return res.status(409).json({ error: 'Already watching this ticker' })
    }

    const watch = await EarningsWatch.create({
      userId: req.user.userId,
      ticker,
      reportDate,
      view,
      notes
    })
    res.status(201).json(watch)
  } catch (error) {
    console.error('Error creating earnings watch:', error.message)
    res.status(500).json({ error: 'Failed to add earnings watch' })
  }
})

// PATCH /api/earnings/:id — update after earnings
router.patch('/:id', async (req, res) => {
  try {
    const watch = await EarningsWatch.findOne({ _id: req.params.id, userId: req.user.userId })
    if (!watch) {
      return res.status(404).json({ error: 'Earnings watch not found' })
    }

    const allowedFields = ['view', 'actualMove', 'notes', 'result', 'reportDate']
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) watch[field] = req.body[field]
    })

    if (req.body.status === 'closed' && !watch.closedAt) {
      watch.closedAt = new Date()
    }

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
    if (!watch) {
      return res.status(404).json({ error: 'Earnings watch not found' })
    }
    res.json({ message: 'Deleted successfully' })
  } catch (error) {
    console.error('Error deleting earnings watch:', error.message)
    res.status(500).json({ error: 'Failed to delete earnings watch' })
  }
})

module.exports = router