const BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  signup: (password) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ password }) }),
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  botTypes: () => request('/api/bots/types'),
  listBots: () => request('/api/bots'),
  createBot: (body) => request('/api/bots', { method: 'POST', body: JSON.stringify(body) }),
  updateBot: (id, body) => request(`/api/bots/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  startBot: (id) => request(`/api/bots/${id}/start`, { method: 'POST' }),
  stopBot: (id) => request(`/api/bots/${id}/stop`, { method: 'POST' }),
  deleteBot: (id) => request(`/api/bots/${id}`, { method: 'DELETE' }),
  botTrades: (id) => request(`/api/bots/${id}/trades`),
  walletBalance: () => request('/api/wallet/balance'),
};
