const yahooFinance = require('yahoo-finance2').default;

const cache = new Map(); // ticker -> { price, changePercent, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPrice(ticker) {
  const now = Date.now();
  const cached = cache.get(ticker);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached;
  }
  try {
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
