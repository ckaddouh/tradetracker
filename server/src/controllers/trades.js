const Trade = require('../models/Trade');
const Idea = require('../models/Idea');

const getTrades = async (req, res, next) => {
  try {
    const trades = await Trade.find({ userId: req.user._id }).sort({ openedAt: -1 });
    res.json({ data: trades, error: null });
  } catch (err) {
    next(err);
  }
};

const createTrade = async (req, res, next) => {
  try {
    const { ideaId, ticker, type, quantity, entryPrice, currentPrice, openedAt } = req.body;
    if (!ideaId || !ticker || !type || !quantity || !entryPrice) {
      return res.status(400).json({ data: null, error: 'ideaId, ticker, type, quantity, and entryPrice are required' });
    }

    // Verify the idea belongs to this user
    const idea = await Idea.findOne({ _id: ideaId, userId: req.user._id });
    if (!idea) {
      return res.status(404).json({ data: null, error: 'Idea not found' });
    }

    const trade = await Trade.create({
      userId: req.user._id,
      ideaId,
      ticker,
      type,
      quantity,
      entryPrice,
      currentPrice: currentPrice || null,
      openedAt: openedAt || Date.now(),
    });
    res.status(201).json({ data: trade, error: null });
  } catch (err) {
    next(err);
  }
};

const getTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, userId: req.user._id });
    if (!trade) return res.status(404).json({ data: null, error: 'Trade not found' });
    res.json({ data: trade, error: null });
  } catch (err) {
    next(err);
  }
};

const updateTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!trade) return res.status(404).json({ data: null, error: 'Trade not found' });
    res.json({ data: trade, error: null });
  } catch (err) {
    next(err);
  }
};

const deleteTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!trade) return res.status(404).json({ data: null, error: 'Trade not found' });
    res.json({ data: { message: 'Trade deleted' }, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTrades, createTrade, getTrade, updateTrade, deleteTrade };
