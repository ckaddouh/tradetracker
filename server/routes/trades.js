const express = require('express')
const router = express.Router()
const TradeIdea = require('../models/TradeIdea')
const verifyToken = require('../middleware/verifyToken')

// All trade routes require authentication
router.use(verifyToken)

// GET /api/trades — get all trades for logged-in user
router.get('/', async (req, res) => {
  try {
    const trades = await TradeIdea.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
    res.json(trades)
  } catch (error) {
    console.error('Error fetching trades:', error.message)
    res.status(500).json({ error: 'Failed to fetch trades' })
  }
})

// POST /api/trades — create a new trade idea
router.post('/', async (req, res) => {
  const { ticker, direction, horizon, reason } = req.body

  if (!ticker || !direction || !horizon || !reason) {
    return res.status(400).json({ error: 'ticker, direction, horizon, and reason are required' })
  }

  try {
    const trade = await TradeIdea.create({
      userId: req.user.userId,
      ticker,
      direction,
      horizon,
      reason
    })
    res.status(201).json(trade)
  } catch (error) {
    console.error('Error creating trade:', error.message)
    res.status(500).json({ error: 'Failed to create trade idea' })
  }
})


// GET /api/trades/chart/:ticker?from=<unix_ts> — proxy Yahoo Finance chart data
// No auth required so the frontend can call it freely; no user data is exposed
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

router.get('/chart/:ticker', async (req, res) => {
  const { ticker } = req.params
  const cacheKey = `${ticker}-${req.query.from}`

  if (cache.has(cacheKey)) {
    const { data, ts } = cache.get(cacheKey)
    if (Date.now() - ts < CACHE_TTL) return res.json(data)
  }

  const from = parseInt(req.query.from) || Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365
  const to = Math.floor(Date.now() / 1000)

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${from}&period2=${to}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com',
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch chart data from Yahoo Finance' })
    }

    const data = await response.json()
    cache.set(cacheKey, { data, ts: Date.now() }) // ✅ cache it
    res.json(data)                                 // ✅ send once
  } catch (error) {
    console.error('Chart proxy error:', error.message)
    res.status(500).json({ error: 'Chart proxy request failed' })
  }
})

// PATCH /api/trades/:id — update a trade (e.g. close it, change status)
router.patch('/:id', async (req, res) => {
  try {
    const trade = await TradeIdea.findOne({ _id: req.params.id, userId: req.user.userId })
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    const allowedFields = ['status', 'outcome', 'reason', 'closedAt']
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        trade[field] = req.body[field]
      }
    })

    if (req.body.status === 'closed' && !trade.closedAt) {
      trade.closedAt = new Date()
    }

    await trade.save()
    res.json(trade)
  } catch (error) {
    console.error('Error updating trade:', error.message)
    res.status(500).json({ error: 'Failed to update trade' })
  }
})

// DELETE /api/trades/:id — delete a trade idea
router.delete('/:id', async (req, res) => {
  try {
    const trade = await TradeIdea.findOneAndDelete({ _id: req.params.id, userId: req.user.userId })
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }
    res.json({ message: 'Trade deleted successfully' })
  } catch (error) {
    console.error('Error deleting trade:', error.message)
    res.status(500).json({ error: 'Failed to delete trade' })
  }
})


module.exports = router