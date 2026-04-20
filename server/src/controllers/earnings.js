const EarningsEvent = require('../models/EarningsEvent');

const getEarnings = async (req, res, next) => {
  try {
    const { ticker, from, to } = req.query;
    const filter = {};

    if (ticker) filter.ticker = ticker.toUpperCase();

    if (from || to) {
      filter.earningsDate = {};
      if (from) filter.earningsDate.$gte = new Date(from);
      if (to) filter.earningsDate.$lte = new Date(to);
    }

    const events = await EarningsEvent.find(filter).sort({ earningsDate: 1 });
    res.json({ data: events, error: null });
  } catch (err) {
    next(err);
  }
};

const createEarningsEvent = async (req, res, next) => {
  try {
    const { ticker, companyName, earningsDate, time, source } = req.body;
    if (!ticker || !companyName || !earningsDate || !time) {
      return res.status(400).json({ data: null, error: 'ticker, companyName, earningsDate, and time are required' });
    }
    const event = await EarningsEvent.create({ ticker, companyName, earningsDate, time, source });
    res.status(201).json({ data: event, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { getEarnings, createEarningsEvent };
