import axios from 'axios';
import Parser from 'rss-parser';

// ─── Config ──────────────────────────────────────────────────────────────────
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': UA },
  customFields: { item: [['source', 'sourceTag']] },
});

// ─── Cache with stale-on-error ───────────────────────────────────────────────
const cache = new Map();

async function withCache(key, fetcher) {
  const c = cache.get(key);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  try {
    const data = await fetcher();
    cache.set(key, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error(`news[${key}] failed:`, err.message);
    return c ? c.data : []; // serve stale data on error, else empty
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Google News titles are "Headline - Publisher"; split off the publisher.
function splitGoogleTitle(title) {
  const idx = (title || '').lastIndexOf(' - ');
  if (idx > 0) {
    return { headline: title.slice(0, idx).trim(), source: title.slice(idx + 3).trim() };
  }
  return { headline: title || '', source: 'Google News' };
}

function itemSource(item, fallback) {
  const s = item.sourceTag;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object') return s['#text'] || s._ || fallback;
  return fallback;
}

function toMs(item) {
  if (item.isoDate) return new Date(item.isoDate).getTime();
  if (item.pubDate) return new Date(item.pubDate).getTime();
  return Date.now();
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.headline || '').toLowerCase().slice(0, 80);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

// ─── Source fetchers ─────────────────────────────────────────────────────────
async function fetchFinnhubCompanyNews(ticker) {
  if (!FINNHUB_KEY) return [];
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000);
  const fmt = d => d.toISOString().slice(0, 10);
  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_KEY}`;
  const res = await axios.get(url, { timeout: 10000 });
  return (Array.isArray(res.data) ? res.data : [])
    .filter(n => n.headline && n.url)
    .slice(0, 8)
    .map(n => ({
      ticker,
      headline: n.headline,
      summary: stripHtml(n.summary).slice(0, 240),
      source: n.source || 'Finnhub',
      url: n.url,
      datetime: (n.datetime || 0) * 1000 || Date.now(),
      image: n.image || null,
    }));
}

async function fetchFinnhubMarketNews() {
  if (!FINNHUB_KEY) return [];
  const url = `${FINNHUB_BASE}/news?category=general&token=${FINNHUB_KEY}`;
  const res = await axios.get(url, { timeout: 10000 });
  return (Array.isArray(res.data) ? res.data : [])
    .filter(n => n.headline && n.url)
    .slice(0, 20)
    .map(n => ({
      headline: n.headline,
      summary: stripHtml(n.summary).slice(0, 240),
      source: n.source || 'Finnhub',
      url: n.url,
      datetime: (n.datetime || 0) * 1000 || Date.now(),
      image: n.image || null,
    }));
}

async function fetchYahooTickerNews(ticker) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`;
  const feed = await parser.parseURL(url);
  return (feed.items || [])
    .filter(i => i.title && i.link)
    .slice(0, 6)
    .map(i => ({
      ticker,
      headline: i.title,
      summary: stripHtml(i.contentSnippet || i.content || '').slice(0, 240),
      source: itemSource(i, 'Yahoo Finance'),
      url: i.link,
      datetime: toMs(i),
      image: null,
    }));
}

async function fetchGoogleNews(query, limit = 10) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const feed = await parser.parseURL(url);
  return (feed.items || [])
    .filter(i => i.title && i.link)
    .slice(0, limit)
    .map(i => {
      const { headline, source } = splitGoogleTitle(i.title);
      return {
        headline,
        summary: stripHtml(i.contentSnippet || i.content || '').slice(0, 240),
        source: itemSource(i, source),
        url: i.link,
        datetime: toMs(i),
        image: null,
      };
    });
}

// ─── Public API ──────────────────────────────────────────────────────────────

// News per portfolio ticker — Finnhub if available, Yahoo RSS fallback.
// Returns an object whose key order follows the input ticker order (deterministic).
async function getPositionNews(tickers) {
  const entries = await Promise.all(
    tickers.map(async ticker => {
      const items = await withCache(`pos:${ticker}`, async () => {
        let items = await fetchFinnhubCompanyNews(ticker);
        if (!items.length) {
          try {
            items = await fetchYahooTickerNews(ticker);
          } catch (e) {
            items = [];
          }
        }
        return dedupe(items).sort((a, b) => b.datetime - a.datetime).slice(0, 8);
      });
      return [ticker, items];
    })
  );
  // Promise.all preserves input order → rebuild object in that order.
  const result = {};
  for (const [ticker, items] of entries) result[ticker] = items;
  return result;
}

// General market-moving news: macro, IPOs, broad market.
async function getMarketNews() {
  return withCache('market', async () => {
    const [fh, ipo] = await Promise.all([
      fetchFinnhubMarketNews(),
      fetchGoogleNews('stock market OR IPO OR Federal Reserve', 12).catch(() => []),
    ]);
    return dedupe([...fh, ...ipo]).sort((a, b) => b.datetime - a.datetime).slice(0, 25);
  });
}

// Sector-specific news via Google News search, one feed per portfolio sector.
// Returns an object whose key order follows the input sector order (order_index).
async function getSectorNews(sectorNames) {
  const entries = await Promise.all(
    sectorNames.map(async name => {
      // Clean sector label into a search-friendly query.
      const query = `${name.replace(/[\/&]/g, ' ')} stocks`;
      const items = await withCache(`sector:${name}`, () =>
        fetchGoogleNews(query, 8).then(items =>
          dedupe(items).sort((a, b) => b.datetime - a.datetime)
        )
      );
      return [name, items];
    })
  );
  const result = {};
  for (const [name, items] of entries) result[name] = items;
  return result;
}

function newsConfigStatus() {
  return { finnhubConfigured: !!FINNHUB_KEY };
}

// Build movement reports for tickers that moved sharply today.
// `movers` = [{ ticker, company_name, changePercent, priceUsd, priceEur }]
// Attaches the most recent news (likely drivers) to each.
async function getMoverReports(movers) {
  return Promise.all(
    movers.map(async m => {
      const news = await withCache(`pos:${m.ticker}`, async () => {
        let items = await fetchFinnhubCompanyNews(m.ticker);
        if (!items.length) {
          try {
            items = await fetchYahooTickerNews(m.ticker);
          } catch (e) {
            items = [];
          }
        }
        return dedupe(items).sort((a, b) => b.datetime - a.datetime).slice(0, 8);
      });
      // Prefer news from the last ~2 days as the likely explanation.
      const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
      const recent = news.filter(n => n.datetime >= cutoff);
      return { ...m, news: (recent.length ? recent : news).slice(0, 5) };
    })
  );
}

export { getPositionNews, getMarketNews, getSectorNews, getMoverReports, newsConfigStatus };
