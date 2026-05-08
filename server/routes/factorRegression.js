/**
 * server/routes/factorRegression.js
 *
 * Proxies POST /api/markets/factor-regression → Python microservice.
 *
 * Environment variables:
 *   FACTOR_SERVICE_URL  — base URL of the Python service (default: http://localhost:8000)
 *
 * Mount in your main Express app:
 *   import factorRegressionRouter from './routes/factorRegression.js'
 *   app.use('/api/markets', factorRegressionRouter)
 */

import express from 'express'

const router = express.Router()

const FACTOR_SERVICE_URL = process.env.FACTOR_SERVICE_URL || 'http://localhost:8000'

// ── Validation helpers ────────────────────────────────────────────────────────

function validateRequest(body) {
  const errors = []

  const { ticker, lookback_years, top_n_factors, lag_weeks } = body

  if (!ticker || typeof ticker !== 'string' || !ticker.trim()) {
    errors.push('ticker is required and must be a non-empty string')
  } else if (!/^[A-Za-z.\-^]{1,10}$/.test(ticker.trim())) {
    errors.push('ticker must be 1–10 characters (letters, dots, hyphens, carets only)')
  }

  if (lookback_years !== undefined) {
    const ly = Number(lookback_years)
    if (!Number.isInteger(ly) || ly < 1 || ly > 20) {
      errors.push('lookback_years must be an integer between 1 and 20')
    }
  }

  if (top_n_factors !== undefined) {
    const tn = Number(top_n_factors)
    if (!Number.isInteger(tn) || tn < 1 || tn > 30) {
      errors.push('top_n_factors must be an integer between 1 and 30')
    }
  }

  if (lag_weeks !== undefined) {
    if (!Array.isArray(lag_weeks) || lag_weeks.length === 0) {
      errors.push('lag_weeks must be a non-empty array')
    } else if (lag_weeks.some(l => !Number.isInteger(Number(l)) || l < 1 || l > 52)) {
      errors.push('each lag_weeks value must be an integer between 1 and 52')
    }
  }

  return errors
}

// ── POST /api/markets/factor-regression ──────────────────────────────────────

router.post('/factor-regression', async (req, res) => {
  // 1. Validate input
  const validationErrors = validateRequest(req.body)
  if (validationErrors.length) {
    return res.status(400).json({ error: 'Validation failed', details: validationErrors })
  }

  // 2. Build clean payload with defaults
  const payload = {
    ticker:         req.body.ticker.trim().toUpperCase(),
    lookback_years: Number(req.body.lookback_years ?? 5),
    top_n_factors:  Number(req.body.top_n_factors  ?? 15),
    lag_weeks:      req.body.lag_weeks ?? [1, 2, 4],
  }

  // 3. Proxy to Python service
  let pythonRes
  try {
    pythonRes = await fetch(`${FACTOR_SERVICE_URL}/api/markets/factor-regression`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      // Regression can take 20-40s — give it breathing room
      signal:  AbortSignal.timeout(120_000),
    })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({
        error:   'Factor regression timed out',
        detail:  'The Python service did not respond within 120 seconds. Try a shorter lookback period.',
      })
    }

    console.error('[factorRegression] Failed to reach Python service:', err.message)
    return res.status(502).json({
      error:  'Factor regression service unavailable',
      detail: 'Could not connect to the Python microservice. Make sure it is running.',
    })
  }

  // 4. Forward the response (success or structured error) back to the client
  let data
  try {
    data = await pythonRes.json()
  } catch {
    return res.status(502).json({
      error:  'Invalid response from factor regression service',
      detail: 'The Python service returned non-JSON output.',
    })
  }

  return res.status(pythonRes.status).json(data)
})

export default router