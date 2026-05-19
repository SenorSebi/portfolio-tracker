import axios from 'axios';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice,regularMarketChangePercent,currency`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
  const result = res.data?.quoteResponse?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);
  return result;
}

async function getPrice(ticker) {
  const now = Date.now();
  const cached = cache.get(ticker);
  if (cached && (now - cached.timestamp) < CACHE_TTL) return cached;

  try {
    const quote = await fetchQuote(ticker);
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

async function getPrices(tickers) {
  // Batch all tickers in one request
  try {
    const now = Date.now();
    const symbols = tickers.join(',');
    const url = `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChangePercent,currency`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const results = res.data?.quoteResponse?.result || [];

    const priceMap = {};
    for (const quote of results) {
      const data = {
        ticker: quote.symbol,
        priceUsd: quote.regularMarketPrice || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        currency: quote.currency || 'USD',
        timestamp: now,
      };
      cache.set(quote.symbol, data);
      priceMap[quote.symbol] = data;
    }

    // Fill missing tickers with cached or zero
    for (const ticker of tickers) {
      if (!priceMap[ticker]) {
        priceMap[ticker] = cache.get(ticker) || { ticker, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now };
      }
    }
    return priceMap;
  } catch (err) {
    console.error('Batch price fetch failed:', err.message);
    // Fall back to individual requests
    const results = await Promise.all(tickers.map(getPrice));
    return Object.fromEntries(results.map(r => [r.ticker, r]));
  }
}

function clearCache() {
  cache.clear();
}

export { getPrice, getPrices, clearCache };
