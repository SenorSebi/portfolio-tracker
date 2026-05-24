import axios from 'axios';

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Yahoo Finance crumb state
let yfCrumb = null;
let yfCookie = null;
let crumbFetchedAt = 0;
const CRUMB_TTL = 60 * 60 * 1000; // refresh crumb every hour

async function getYahooCrumb() {
  if (yfCrumb && (Date.now() - crumbFetchedAt) < CRUMB_TTL) return { crumb: yfCrumb, cookie: yfCookie };

  try {
    // Step 1: get session cookie from finance.yahoo.com
    const r1 = await axios.get('https://finance.yahoo.com/', {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    const setCookie = r1.headers['set-cookie'];
    yfCookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : '';

    // Step 2: get crumb
    const r2 = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': yfCookie },
      timeout: 8000,
    });
    yfCrumb = r2.data;
    crumbFetchedAt = Date.now();
    console.log('Yahoo Finance crumb refreshed:', yfCrumb);
    return { crumb: yfCrumb, cookie: yfCookie };
  } catch (err) {
    console.error('Crumb fetch failed:', err.message);
    return null;
  }
}

async function fetchYahooBatch(tickers) {
  const auth = await getYahooCrumb();
  const symbols = tickers.join(',');

  const params = new URLSearchParams({ symbols, fields: 'regularMarketPrice,regularMarketChangePercent,currency' });
  if (auth?.crumb) params.set('crumb', auth.crumb);

  const url = `https://query2.finance.yahoo.com/v8/finance/quote?${params}`;
  const res = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      ...(auth?.cookie ? { 'Cookie': auth.cookie } : {}),
    },
    timeout: 12000,
  });

  return res.data?.quoteResponse?.result || [];
}

// EUR/USD via exchangerate-api (no key, no limits)
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

  // EUR/USD separately
  const eurUsdCached = cache.get('EURUSD=X');
  if (!eurUsdCached || (now - eurUsdCached.timestamp) >= CACHE_TTL) {
    const rate = await fetchEurUsd();
    cache.set('EURUSD=X', { ticker: 'EURUSD=X', priceUsd: rate, changePercent: 0, currency: 'USD', timestamp: now });
  }

  // Stock tickers that need refresh
  const stockTickers = tickers.filter(t => t !== 'EURUSD=X');
  const missing = stockTickers.filter(t => {
    const c = cache.get(t);
    return !c || (now - c.timestamp) >= CACHE_TTL;
  });

  if (missing.length > 0) {
    try {
      const quotes = await fetchYahooBatch(missing);
      for (const q of quotes) {
        cache.set(q.symbol, {
          ticker: q.symbol,
          priceUsd: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
          currency: q.currency || 'USD',
          timestamp: now,
        });
      }
      // Mark tickers with no result so they don't retry until cache expires
      for (const t of missing) {
        if (!cache.has(t)) {
          cache.set(t, { ticker: t, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now });
        }
      }
    } catch (err) {
      console.error('Yahoo batch fetch failed:', err.message);
      // Invalidate crumb so next call retries
      yfCrumb = null;
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
  yfCrumb = null; // force crumb refresh too
}

export { getPrices, clearCache };
