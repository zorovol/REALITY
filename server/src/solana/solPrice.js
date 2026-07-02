/** Cached SOL/USD for fixed-dollar trade sizing. */
let cachedPrice = 0;
let cachedAt = 0;
const TTL_MS = 60_000;

export async function getSolUsdPrice(fallback = 150) {
  const now = Date.now();
  if (cachedPrice > 0 && now - cachedAt < TTL_MS) return cachedPrice;

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      const p = Number(data?.solana?.usd);
      if (p > 0) {
        cachedPrice = p;
        cachedAt = now;
        return p;
      }
    }
  } catch (err) {
    console.warn('[sol-price] fetch failed, using fallback:', err.message);
  }

  if (cachedPrice > 0) return cachedPrice;
  return fallback;
}

export function usdToSol(usd, solUsd) {
  if (!solUsd || solUsd <= 0) return usd / 150;
  return usd / solUsd;
}
