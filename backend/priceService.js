import axios from 'axios';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const API_KEY = process.env.TWELVEDATA_API_KEY;

// EUR/USD via exchangerate-api (no key needed)
async function fetchEurUsd() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 });
    const eurPerUsd = res.data?.rates?.EUR;
    if (eurPerUsd) return 1 / eurPerUsd; // return USD per EUR
  } catch (e) {
    console.error('EUR/USD fetch failed:', e.message);
  }
  return 1.08;
}

async function fetchTwelveDataBatch(tickers) {
  if (!API_KEY) throw new Error('TWELVEDATA_API_KEY not set');
  const symbols = tickers.join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${API_KEY}`;
  const res = await axios.get(url, { timeout: 15000 });
  return res.data;
}

async function getPrices(tickers) {
  const now = Date.now();

  // Check cache first
  const missing = tickers.filter(t => {
    if (t === 'EURUSD=X') return false; // handle separately
    const c = cache.get(t);
    return !c || (now - c.timestamp) >= CACHE_TTL;
  });

  // EUR/USD rate
  const eurUsdCached = cache.get('EURUSD=X');
  let eurUsdRate = eurUsdCached?.priceUsd;
  if (!eurUsdCached || (now - eurUsdCached.timestamp) >= CACHE_TTL) {
    eurUsdRate = await fetchEurUsd();
    cache.set('EURUSD=X', { ticker: 'EURUSD=X', priceUsd: eurUsdRate, changePercent: 0, currency: 'USD', timestamp: now });
  }

  // Fetch missing stock prices
  if (missing.length > 0 && API_KEY) {
    try {
      const data = await fetchTwelveDataBatch(missing);
      // Twelve Data returns object if single ticker, or object of objects if multiple
      const quotes = missing.length === 1 ? { [missing[0]]: data } : data;

      for (const [symbol, quote] of Object.entries(quotes)) {
        if (quote.status === 'error' || !quote.close) {
          console.error(`No data for ${symbol}:`, quote.message || 'unknown error');
          continue;
        }
        cache.set(symbol, {
          ticker: symbol,
          priceUsd: parseFloat(quote.close) || 0,
          changePercent: parseFloat(quote.percent_change) || 0,
          currency: quote.currency || 'USD',
          timestamp: now,
        });
      }
    } catch (err) {
      console.error('Twelve Data batch fetch failed:', err.message);
    }
  } else if (missing.length > 0 && !API_KEY) {
    console.warn('TWELVEDATA_API_KEY not configured — prices unavailable');
  }

  // Build result from cache
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
