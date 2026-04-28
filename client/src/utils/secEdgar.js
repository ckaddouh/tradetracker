const BASE = '/api/markets'

async function get(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data
}

export async function fetchCompany10K(ticker) {
  return get(`/sec/${ticker.toUpperCase()}`)
}