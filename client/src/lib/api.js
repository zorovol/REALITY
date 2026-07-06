const BASE = '';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach server. Check that the backend is running.');
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (res.status === 503) throw new Error('Trading server not configured — set AUTH_SERVER_KEY on Render.');
    if (res.status === 404) throw new Error('API not found — redeploy Render backend with latest code.');
    throw new Error(`Server error (${res.status}). Try again after deploy finishes.`);
  }

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export const api = {
  registerWallet: (body) => request('/api/auth/register-wallet', { method: 'POST', body: JSON.stringify(body) }),
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
