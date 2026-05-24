import axios from 'axios';

const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes — FMP free tier: 250 req/day

const FMP_KEY = process.env.FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

async function fetchFmpBatch(tickers) {
  if (!FMP_KEY) throw new Error('FMP_API_KEY not set');
  const symbols = tickers.join(',');
  const res = await axios.get(`${FMP_BASE}/quote/${encodeURIComponent(symbols)}?apikey=${FMP_KEY}`, { timeout: 12000 });
  return res.data; // array of quote objects
}

async function fetchEurUsd() {
  try {
    // FMP forex endpoint
    if (FMP_KEY) {
      const res = await axios.get(`${FMP_BASE}/fx/EURUSD?apikey=${FMP_KEY}`, { timeout: 8000 });
      const rate = res.data?.[0]?.bid || res.data?.[0]?.price;
      if (rate) return parseFloat(rate);
    }
    // Fallback: exchangerate-api (no key needed)
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

  // EUR/USD separately
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
      try {
        const quotes = await fetchFmpBatch(missing);
        if (!Array.isArray(quotes)) throw new Error(`FMP returned: ${JSON.stringify(quotes)}`);

        for (const q of quotes) {
          cache.set(q.symbol, {
            ticker: q.symbol,
            priceUsd: q.price || 0,
            changePercent: q.changesPercentage || 0,
            currency: 'USD',
            timestamp: now,
          });
        }

        // tickers with no FMP result → mark with 0 so they don't retry immediately
        for (const t of missing) {
          if (!cache.has(t)) {
            console.warn(`No FMP data for ${t}`);
            cache.set(t, { ticker: t, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now });
          }
        }
      } catch (err) {
        console.error('FMP batch fetch failed:', err.message);
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
