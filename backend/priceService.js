import axios from 'axios';

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour — Twelve Data free: 800 credits/day

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const TD_BASE = 'https://api.twelvedata.com';

async function fetchTdQuotes(tickers) {
  const symbols = tickers.join(',');
  const res = await axios.get(`${TD_BASE}/quote?symbol=${symbols}&apikey=${TD_KEY}`, { timeout: 15000 });
  const data = res.data;
  // Single symbol → flat object; multiple → object keyed by symbol
  return tickers.length === 1 ? { [tickers[0]]: data } : data;
}

async function fetchEurUsd() {
  try {
    if (TD_KEY) {
      const res = await axios.get(`${TD_BASE}/exchange_rate?symbol=EUR/USD&apikey=${TD_KEY}`, { timeout: 8000 });
      const rate = parseFloat(res.data?.rate);
      if (rate && !isNaN(rate)) return rate;
    }
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
    if (!TD_KEY) {
      console.warn('TWELVE_DATA_API_KEY not set — no live prices');
    } else {
      try {
        const quotes = await fetchTdQuotes(missing);
        for (const ticker of missing) {
          const q = quotes[ticker];
          if (q && !q.code && q.close) {
            cache.set(ticker, {
              ticker,
              priceUsd: parseFloat(q.close) || 0,
              changePercent: parseFloat(q.percent_change) || 0,
              currency: q.currency || 'USD',
              timestamp: now,
            });
          } else {
            if (q?.code) console.error(`Twelve Data error for ${ticker}: [${q.code}] ${q.message}`);
            cache.set(ticker, { ticker, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now });
          }
        }
      } catch (err) {
        console.error('Twelve Data fetch failed:', err.message);
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
