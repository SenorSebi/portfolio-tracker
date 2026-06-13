import axios from 'axios';

// ─── Config ──────────────────────────────────────────────────────────────────
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 h — calendar data changes slowly

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const cache = new Map();

async function withCache(key, fetcher) {
  const c = cache.get(key);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  try {
    const data = await fetcher();
    cache.set(key, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error(`events[${key}] failed:`, err.message);
    return c ? c.data : [];
  }
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(fromIso + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (24 * 3600 * 1000));
}

// ─── Source fetchers ─────────────────────────────────────────────────────────
async function fetchFinnhubEarnings(ticker) {
  if (!FINNHUB_KEY) return null;
  const from = new Date();
  const to = new Date(from.getTime() + 100 * 24 * 3600 * 1000);
  const url = `${FINNHUB_BASE}/calendar/earnings?from=${isoDate(from)}&to=${isoDate(to)}&symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`;
  const res = await axios.get(url, { timeout: 10000 });
  const list = res.data?.earningsCalendar || [];
  const todayIso = isoDate(new Date());
  const future = list
    .filter(e => e.date && e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!future.length) return null;
  const next = future[0];
  const hour = next.hour === 'bmo' ? 'vorbörslich' : next.hour === 'amc' ? 'nachbörslich' : '';
  return {
    type: 'earnings',
    date: next.date,
    daysUntil: daysBetween(next.date),
    label: `Q${next.quarter || ''}-Bericht`,
    detail: [hour, next.epsEstimate != null ? `EPS-Est. ${next.epsEstimate}` : ''].filter(Boolean).join(' · '),
  };
}

// Yahoo fallback for the next earnings date (works without a Finnhub key).
async function fetchYahooEarnings(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents`;
  const res = await axios.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 10000 });
  const raw = res.data?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
  if (!raw) return null;
  const date = isoDate(new Date(raw * 1000));
  if (daysBetween(date) < 0) return null;
  return { type: 'earnings', date, daysUntil: daysBetween(date), label: 'Q-Bericht', detail: '' };
}

async function fetchFinnhubSplit(ticker) {
  if (!FINNHUB_KEY) return null;
  const from = new Date();
  const to = new Date(from.getTime() + 180 * 24 * 3600 * 1000);
  const url = `${FINNHUB_BASE}/stock/split?symbol=${encodeURIComponent(ticker)}&from=${isoDate(from)}&to=${isoDate(to)}&token=${FINNHUB_KEY}`;
  const res = await axios.get(url, { timeout: 10000 });
  const list = Array.isArray(res.data) ? res.data : [];
  const todayIso = isoDate(new Date());
  const upcoming = list
    .filter(s => s.date && s.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  const s = upcoming[0];
  const ratio = s.fromFactor && s.toFactor ? `${s.toFactor}:${s.fromFactor}` : '';
  return {
    type: 'split',
    date: s.date,
    daysUntil: daysBetween(s.date),
    label: `Split${ratio ? ' ' + ratio : ''}`,
    detail: '',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────
// Returns { ticker: [ {type, date, daysUntil, label, detail}, ... ] } (deterministic order).
async function getUpcomingEvents(tickers) {
  const entries = await Promise.all(
    tickers.map(async ticker => {
      const events = await withCache(`evt:${ticker}`, async () => {
        const out = [];

        // Earnings: Finnhub first, Yahoo fallback.
        let earnings = null;
        try {
          earnings = await fetchFinnhubEarnings(ticker);
        } catch (e) { /* fall through */ }
        if (!earnings) {
          try {
            earnings = await fetchYahooEarnings(ticker);
          } catch (e) { /* ignore */ }
        }
        if (earnings) out.push(earnings);

        // Splits (Finnhub only, best-effort).
        try {
          const split = await fetchFinnhubSplit(ticker);
          if (split) out.push(split);
        } catch (e) { /* ignore */ }

        return out.sort((a, b) => a.daysUntil - b.daysUntil);
      });
      return [ticker, events];
    })
  );
  const result = {};
  for (const [ticker, events] of entries) result[ticker] = events;
  return result;
}

function eventsConfigStatus() {
  return { finnhubConfigured: !!FINNHUB_KEY };
}

export { getUpcomingEvents, eventsConfigStatus };
