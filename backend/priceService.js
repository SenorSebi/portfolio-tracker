import axios from 'axios';

const cache = new Map();
// FMP free plan: 250 req/day, no batch queries → individual calls, 2h cache
const CACHE_TTL = 2 * 60 * 60 * 1000;

const FMP_KEY = process.env.FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/stable';

async function fetchFmpSingle(ticker) {
  const res = await axios.get(`${FMP_BASE}/quote?symbol=${ticker}&apikey=${FMP_KEY}`, { timeout: 12000 });
  return res.data?.[0] || null;
}

async function fetchEurUsd() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 });
    const eurPerUsd = res.data?.rates?.EUR;
    if (eurPerUsd) return 1 / eurPerUsd;
  } catch (e) {
    console.error('EUR/USD fetch failed:', e.message);
  }
  return 1.08;
}

async function getPrices(tickers) {
  const now = Date.now();

  const eurCached = cache.get('EURUSD=X');
  if (!eurCached || (now - eurCached.timestamp) >= CACHE_TTL) {
    const rate = await fetchEurUsd();
    cache.set('EURUSD=X', { ticker: 'EURUSD=X', priceUsd: rate, changePercent: 0, currency: 'USD', timestamp: now });
  }

  const stockTickers = tickers.filter(t => t !== 'EURUSD=X');
  const missing = stockTickers.filter(t => {
    const c = cache.get(t);
    return !c || (now - c.timestamp) >= CACHE_TTL;
  });

  if (missing.length > 0) {
    if (!FMP_KEY) {
      console.warn('FMP_API_KEY not set — no live prices');
    } else {
      const results = await Promise.allSettled(missing.map(t => fetchFmpSingle(t)));
      for (let i = 0; i < missing.length; i++) {
        const ticker = missing[i];
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          const q = result.value;
          cache.set(ticker, {
            ticker,
            priceUsd: q.price || 0,
            changePercent: q.changePercentage ?? q.changesPercentage ?? 0,
            currency: 'USD',
            timestamp: now,
          });
        } else {
          if (result.status === 'rejected') {
            console.error(`FMP fetch failed for ${ticker}:`, result.reason?.message);
          }
          cache.set(ticker, { ticker, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now });
        }
      }
    }
  }

  const result = {};
  for (const ticker of tickers) {
    result[ticker] = cache.get(ticker) || { ticker, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now };
  }
  return result;
}

function clearCache() {
  cache.clear();
}

export { getPrices, clearCache };
