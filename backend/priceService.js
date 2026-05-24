import axios from 'axios';

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
const RETRY_AFTER = 2 * 60 * 1000;

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const TD_BASE = 'https://api.twelvedata.com';

const BATCH_SIZE = 7;
const BATCH_INTERVAL_MS = 65 * 1000;

let batchQueue = [];
let batchTimeout = null;
let nextBatchAt = null;

async function fetchTdQuotes(tickers) {
  const symbols = tickers.join(',');
  const res = await axios.get(`${TD_BASE}/quote?symbol=${symbols}&apikey=${TD_KEY}`, { timeout: 15000 });
  const data = res.data;
  return tickers.length === 1 ? { [tickers[0]]: data } : data;
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

function setCacheEntry(ticker, priceUsd, changePercent, currency = 'USD') {
  const now = Date.now();
  const timestamp = priceUsd > 0 ? now : now - CACHE_TTL + RETRY_AFTER;
  cache.set(ticker, { ticker, priceUsd, changePercent, currency, timestamp });
}

async function fetchAndCache(tickers) {
  if (!tickers.length || !TD_KEY) return;
  try {
    const quotes = await fetchTdQuotes(tickers);
    for (const ticker of tickers) {
      const q = quotes[ticker];
      if (q && !q.code && q.close) {
        setCacheEntry(ticker, parseFloat(q.close) || 0, parseFloat(q.percent_change) || 0, q.currency || 'USD');
      } else {
        if (q?.code) console.error(`TD [${q.code}] ${ticker}: ${q.message}`);
        setCacheEntry(ticker, 0, 0);
      }
    }
  } catch (err) {
    console.error('TD batch failed:', err.message);
  }
}

function scheduleBackgroundBatch(tickers) {
  for (const t of tickers) {
    if (!batchQueue.includes(t)) batchQueue.push(t);
  }
  if (!batchTimeout) {
    nextBatchAt = Date.now() + BATCH_INTERVAL_MS;
    batchTimeout = setTimeout(runBackgroundBatch, BATCH_INTERVAL_MS);
  }
}

async function runBackgroundBatch() {
  batchTimeout = null;
  nextBatchAt = null;
  if (!batchQueue.length || !TD_KEY) return;
  const batch = batchQueue.splice(0, BATCH_SIZE);
  await fetchAndCache(batch);
  if (batchQueue.length > 0) {
    nextBatchAt = Date.now() + BATCH_INTERVAL_MS;
    batchTimeout = setTimeout(runBackgroundBatch, BATCH_INTERVAL_MS);
  }
}

async function getPrices(tickers) {
  const now = Date.now();

  const eurCached = cache.get('EURUSD=X');
  if (!eurCached || now - eurCached.timestamp >= CACHE_TTL) {
    const rate = await fetchEurUsd();
    cache.set('EURUSD=X', { ticker: 'EURUSD=X', priceUsd: rate, changePercent: 0, currency: 'USD', timestamp: now });
  }

  const stockTickers = tickers.filter(t => t !== 'EURUSD=X');
  const stale = stockTickers.filter(t => {
    const c = cache.get(t);
    return !c || now - c.timestamp >= CACHE_TTL;
  });

  if (stale.length > 0 && TD_KEY) {
    await fetchAndCache(stale.slice(0, BATCH_SIZE));
    if (stale.length > BATCH_SIZE) scheduleBackgroundBatch(stale.slice(BATCH_SIZE));
  } else if (!TD_KEY) {
    console.warn('TWELVE_DATA_API_KEY not set — no live prices');
  }

  const result = {};
  for (const ticker of tickers) {
    result[ticker] = cache.get(ticker) || { ticker, priceUsd: 0, changePercent: 0, currency: 'USD', timestamp: now };
  }
  return result;
}

function clearCache() {
  batchQueue = [];
  if (batchTimeout) { clearTimeout(batchTimeout); batchTimeout = null; }
  nextBatchAt = null;
  cache.clear();
}

function getRefreshStatus(tickers) {
  const now = Date.now();
  const updated = tickers.filter(t => {
    const c = cache.get(t);
    return c && c.priceUsd > 0 && (now - c.timestamp) < CACHE_TTL;
  }).length;
  return {
    total: tickers.length,
    updated,
    pending: batchQueue.length,
    nextBatchAt,
    done: batchQueue.length === 0 && nextBatchAt === null,
  };
}

export { getPrices, clearCache, getRefreshStatus };
