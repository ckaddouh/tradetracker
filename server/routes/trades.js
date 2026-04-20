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
  const { ticker, direction, assetClass, conviction, entryPrice, targetPrice, stopLoss, thesis } = req.body

  if (!ticker || !direction || !assetClass || !conviction || !thesis) {
    return res.status(400).json({ error: 'ticker, direction, assetClass, conviction, and thesis are required' })
  }

  try {
    const trade = await TradeIdea.create({
      userId: req.user.userId,
      ticker,
      direction,
      assetClass,
      conviction,
      entryPrice,
      targetPrice,
      stopLoss,
      thesis
    })
    res.status(201).json(trade)
  } catch (error) {
    console.error('Error creating trade:', error.message)
    res.status(500).json({ error: 'Failed to create trade idea' })
  }
})

// PATCH /api/trades/:id — update a trade (e.g. close it, change status)
router.patch('/:id', async (req, res) => {
  try {
    const trade = await TradeIdea.findOne({ _id: req.params.id, userId: req.user.userId })
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    const allowedFields = ['status', 'outcome', 'targetPrice', 'stopLoss', 'thesis', 'closedAt']
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