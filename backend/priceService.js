// yahoo-finance2 is ESM-only; use dynamic import from CJS
let _yahooFinance = null;

async function getYahooFinance() {
  if (!_yahooFinance) {
    const mod = await import('yahoo-finance2');
    _yahooFinance = mod.default; // already an instance, not a class
  }
  return _yahooFinance;
}

const cache = new Map(); // ticker -> { ticker, priceUsd, changePercent, currency, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPrice(ticker) {
  const now = Date.now();
  const cached = cache.get(ticker);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached;
  }
  try {
    const yahooFinance = await getYahooFinance();
    const quote = await yahooFinance.quote(ticker);
    const data = {
      ticker,
      priceUsd: quote.regularMarketPrice || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || 'USD',
      timestamp: now,
    };
    cache.set(ticker, data);
    return data;
  } catch (err) {
    console.error(`Price fetch failed for ${ticker}:`, err.message);
    return cached || { ticker, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now };
  }
}

async function getEurUsdRate() {
  return getPrice('EURUSD=X').then(d => d.priceUsd || 1.08);
}

async function getPrices(tickers) {
  const results = await Promise.all(tickers.map(getPrice));
  return Object.fromEntries(results.map(r => [r.ticker, r]));
}

function clearCache() {
  cache.clear();
}

module.exports = { getPrice, getEurUsdRate, getPrices, clearCache };
