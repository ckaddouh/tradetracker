const BASE = '/api'

function getToken() {
  return localStorage.getItem('tt_token')
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(`Server error: ${res.status} ${res.statusText}`)
  }

  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`)
  return json.data
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
}