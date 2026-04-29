// Client-side market analyzer — calls your Express server, never Groq directly.
// All three functions mirror the server routes in server/routes/markets.js

const BASE = `${import.meta.env.VITE_API_URL}/api/markets`
console.log('API BASE:', BASE)

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data
}

/**
 * Extract a structured dependency tree from 10-K text.
 * Calls POST /api/markets/extract-tree
 */
export async function extractDependencyTree(ticker, companyName, tenKText) {
  return post('/extract-tree', { ticker, companyName, tenKText })
}

/**
 * Find which public companies are most exposed to a given supply chain node.
 * Calls POST /api/markets/exposed-companies
 */
export async function findExposedCompanies(nodeName, nodeDescription) {
  return post('/exposed-companies', { nodeName, nodeDescription })
}

/**
 * Analyze a news article against the loaded dependency tree.
 * Calls POST /api/markets/analyze-news
 */
export async function analyzeNewsArticle(articleText, tree) {
  return post('/analyze-news', { articleText, tree })
}