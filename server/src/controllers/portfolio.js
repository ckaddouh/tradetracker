const Trade = require('../models/Trade');
const axios = require('axios');

const fetchCurrentPrice = async (ticker) => {
  try {
    const apiKey = process.env.STOCK_API_KEY;
    if (!apiKey) {
      throw new Error('Stock API key not configured');
    }
    const response = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`);
    const data = response.data['Global Quote'];
    if (data && data['05. price']) {
      return parseFloat(data['05. price']);
    }
    return null;
  } catch (err) {
    console.error(`Error fetching price for ${ticker}:`, err.message);
    return null;
  }
};

const getPortfolio = async (req, res, next) => {
  try {
    const trades = await Trade.find({ userId: req.user._id });

    const openTrades = trades.filter((t) => t.status === 'open');
    const closedTrades = trades.filter((t) => t.status === 'closed');

    // Get unique tickers for open trades
    const uniqueTickers = [...new Set(openTrades.map(t => t.ticker))];

    // Fetch current prices
    const pricePromises = uniqueTickers.map(ticker => fetchCurrentPrice(ticker));
    const prices = await Promise.all(pricePromises);
    const priceMap = {};
    uniqueTickers.forEach((ticker, i) => {
      priceMap[ticker] = prices[i];
    });

    // Update currentPrice in DB for open trades
    for (const trade of openTrades) {
      if (priceMap[trade.ticker] != null) {
        trade.currentPrice = priceMap[trade.ticker];
        await trade.save();
      }
    }

    // Realised P&L: closed trades where we have currentPrice (exit price)
    const realisedPnl = closedTrades.reduce((sum, t) => {
      if (t.currentPrice != null) {
        return sum + (t.currentPrice - t.entryPrice) * t.quantity;
      }
      return sum;
    }, 0);

    // Unrealised P&L: open trades with currentPrice
    const unrealisedPnl = openTrades.reduce((sum, t) => {
      if (t.currentPrice != null) {
        return sum + (t.currentPrice - t.entryPrice) * t.quantity;
      }
      return sum;
    }, 0);

    // Group open positions by ticker
    const positionMap = {};
    for (const t of openTrades) {
      if (!positionMap[t.ticker]) {
        positionMap[t.ticker] = { ticker: t.ticker, quantity: 0, costBasis: 0, currentValue: 0 };
      }
      positionMap[t.ticker].quantity += t.quantity;
      positionMap[t.ticker].costBasis += t.entryPrice * t.quantity;
      if (t.currentPrice != null) {
        positionMap[t.ticker].currentValue += t.currentPrice * t.quantity;
      }
    }

    res.json({
      data: {
        totalTrades: trades.length,
        openPositions: Object.values(positionMap),
        realisedPnl: parseFloat(realisedPnl.toFixed(2)),
        unrealisedPnl: parseFloat(unrealisedPnl.toFixed(2)),
        totalPnl: parseFloat((realisedPnl + unrealisedPnl).toFixed(2)),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

const getPerformance = async (req, res, next) => {
  try {
    const trades = await Trade.find({ userId: req.user._id, status: 'closed' }).sort({ closedAt: 1 });

    let runningPnl = 0;
    const equityCurve = trades
      .filter((t) => t.closedAt && t.currentPrice != null)
      .map((t) => {
        const pnl = (t.currentPrice - t.entryPrice) * t.quantity;
        runningPnl += pnl;
        return {
          date: t.closedAt,
          ticker: t.ticker,
          pnl: parseFloat(pnl.toFixed(2)),
          cumulativePnl: parseFloat(runningPnl.toFixed(2)),
        };
      });

    res.json({ data: equityCurve, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPortfolio, getPerformance };
