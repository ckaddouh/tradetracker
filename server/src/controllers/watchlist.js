const Watchlist = require('../models/Watchlist');

const getWatchlist = async (req, res, next) => {
  try {
    const items = await Watchlist.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ data: items, error: null });
  } catch (err) {
    next(err);
  }
};

const addToWatchlist = async (req, res, next) => {
  try {
    const { ticker, notes } = req.body;
    if (!ticker) {
      return res.status(400).json({ data: null, error: 'ticker is required' });
    }

    // Prevent duplicates per user
    const existing = await Watchlist.findOne({ userId: req.user._id, ticker: ticker.toUpperCase() });
    if (existing) {
      return res.status(409).json({ data: null, error: 'Ticker already on watchlist' });
    }

    const item = await Watchlist.create({ userId: req.user._id, ticker, notes });
    res.status(201).json({ data: item, error: null });
  } catch (err) {
    next(err);
  }
};

const removeFromWatchlist = async (req, res, next) => {
  try {
    const item = await Watchlist.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) return res.status(404).json({ data: null, error: 'Watchlist item not found' });
    res.json({ data: { message: 'Removed from watchlist' }, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist };
