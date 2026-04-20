const axios = require('axios');

const fetchHistoricalPrices = async (req, res, next) => {
  try {
    const { ticker, period } = req.query;
    if (!ticker) {
      return res.status(400).json({ data: null, error: 'Ticker is required' });
    }

    const apiKey = process.env.STOCK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ data: null, error: 'Stock API key not configured' });
    }

    // Determine function based on period
    let func = 'TIME_SERIES_DAILY';
    let outputsize = 'compact'; // last 100 days
    if (period === '1Y') {
      outputsize = 'full'; // up to 20 years
    } else if (period === '6M' || period === '3M') {
      outputsize = 'full';
    }
    // For intraday, but for simplicity, use daily

    const response = await axios.get(`https://www.alphavantage.co/query?function=${func}&symbol=${ticker}&outputsize=${outputsize}&apikey=${apiKey}`);

    const data = response.data;
    if (data['Error Message']) {
      return res.status(400).json({ data: null, error: data['Error Message'] });
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      return res.status(404).json({ data: null, error: 'No data available' });
    }

    // Convert to array of {date, close}
    const prices = Object.keys(timeSeries)
      .sort()
      .map(date => ({
        date,
        close: parseFloat(timeSeries[date]['4. close'])
      }));

    // Filter based on period
    let days = 30;
    if (period === '3M') days = 90;
    else if (period === '6M') days = 180;
    else if (period === '1Y') days = 365;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const filtered = prices.filter(p => new Date(p.date) >= cutoff);

    res.json({ data: filtered, error: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchHistoricalPrices };