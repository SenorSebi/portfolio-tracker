import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import db from './database.js';
import { getPrices, clearCache, getRefreshStatus } from './priceService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── GET /api/debug/prices ───────────────────────────────────────────────────
app.get('/api/debug/prices', async (req, res) => {
  const key = process.env.TWELVE_DATA_API_KEY;
  const result = { keySet: !!key, keyPrefix: key ? key.slice(0, 6) + '...' : null };

  const dbTickers = db.prepare('SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL').all().map(r => r.ticker);
  result.dbTickers = dbTickers;

  // Test batch quote for all DB tickers
  try {
    const symbols = dbTickers.join(',');
    const r = await axios.get(`https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${key}`, { timeout: 15000 });
    const data = r.data;
    result.batchResult = {};
    for (const ticker of dbTickers) {
      const q = dbTickers.length === 1 ? data : data[ticker];
      if (q && !q.code && q.close) {
        result.batchResult[ticker] = { ok: true, price: q.close, change: q.percent_change };
      } else {
        result.batchResult[ticker] = { ok: false, code: q?.code, msg: q?.message };
      }
    }
  } catch (err) {
    result.batchError = err.message;
  }

  // Test EUR/USD
  try {
    const r = await axios.get(`https://api.twelvedata.com/exchange_rate?symbol=EUR/USD&apikey=${key}`, { timeout: 8000 });
    result.eurUsd = r.data;
  } catch (err) {
    result.eurUsdError = err.message;
  }

  res.json(result);
});

// ─── GET /api/prices/status ──────────────────────────────────────────────────
app.get('/api/prices/status', (req, res) => {
  const tickers = db.prepare('SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL').all().map(r => r.ticker);
  res.json(getRefreshStatus(tickers));
});

// ─── GET /api/portfolio ─────────────────────────────────────────────────────
app.get('/api/portfolio', async (req, res) => {
  try {
    const sectors = db.prepare('SELECT * FROM sectors ORDER BY order_index').all();

    for (const sector of sectors) {
      const positions = db.prepare('SELECT * FROM positions WHERE sector_id = ?').all(sector.id);
      for (const position of positions) {
        position.dca_zones = db.prepare('SELECT * FROM dca_zones WHERE position_id = ? ORDER BY price_eur DESC').all(position.id);
      }
      sector.positions = positions;
    }

    const tickers = new Set(['EURUSD=X']);
    for (const sector of sectors) {
      for (const position of sector.positions) {
        if (position.ticker) tickers.add(position.ticker);
      }
    }

    const prices = await getPrices(Array.from(tickers));
    const eurUsdRate = prices['EURUSD=X']?.priceUsd || 1.08;

    res.json({ eurUsdRate, sectors, prices });
  } catch (err) {
    console.error('GET /api/portfolio error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/positions/:id ──────────────────────────────────────────────────
app.get('/api/positions/:id', (req, res) => {
  try {
    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
    if (!position) return res.status(404).json({ error: 'Position not found' });

    position.dca_zones = db.prepare('SELECT * FROM dca_zones WHERE position_id = ? ORDER BY price_eur DESC').all(position.id);
    position.trades = db.prepare('SELECT * FROM trades WHERE position_id = ? ORDER BY trade_date DESC').all(position.id);

    res.json(position);
  } catch (err) {
    console.error('GET /api/positions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/positions ─────────────────────────────────────────────────────
app.post('/api/positions', (req, res) => {
  try {
    const { sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes, dca_zones } = req.body;

    if (!ticker || !company_name || !sector_id) {
      return res.status(400).json({ error: 'ticker, company_name, and sector_id are required' });
    }

    const result = db.prepare(
      `INSERT INTO positions (sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sector_id, ticker.toUpperCase(), company_name, position_type || 'Core', shares || 0, avg_cost_eur || 0, target_size_eur || 0, stop_loss_eur || null, notes || '');

    const positionId = result.lastInsertRowid;

    if (Array.isArray(dca_zones) && dca_zones.length > 0) {
      const insertDca = db.prepare('INSERT INTO dca_zones (position_id, price_eur, label) VALUES (?, ?, ?)');
      for (const zone of dca_zones) {
        insertDca.run(positionId, zone.price_eur, zone.label || '');
      }
    }

    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    position.dca_zones = db.prepare('SELECT * FROM dca_zones WHERE position_id = ? ORDER BY price_eur DESC').all(positionId);

    res.status(201).json(position);
  } catch (err) {
    console.error('POST /api/positions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/positions/:id ──────────────────────────────────────────────────
app.put('/api/positions/:id', (req, res) => {
  try {
    const { sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes, dca_zones } = req.body;

    const existing = db.prepare('SELECT id FROM positions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Position not found' });

    db.prepare(
      `UPDATE positions SET sector_id=?, ticker=?, company_name=?, position_type=?,
       shares=?, avg_cost_eur=?, target_size_eur=?, stop_loss_eur=?, notes=? WHERE id=?`
    ).run(sector_id, ticker ? ticker.toUpperCase() : ticker, company_name, position_type || 'Core', shares || 0, avg_cost_eur || 0, target_size_eur || 0, stop_loss_eur || null, notes || '', req.params.id);

    db.prepare('DELETE FROM dca_zones WHERE position_id = ?').run(req.params.id);
    if (Array.isArray(dca_zones) && dca_zones.length > 0) {
      const insertDca = db.prepare('INSERT INTO dca_zones (position_id, price_eur, label) VALUES (?, ?, ?)');
      for (const zone of dca_zones) {
        insertDca.run(req.params.id, zone.price_eur, zone.label || '');
      }
    }

    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
    position.dca_zones = db.prepare('SELECT * FROM dca_zones WHERE position_id = ? ORDER BY price_eur DESC').all(req.params.id);

    res.json(position);
  } catch (err) {
    console.error('PUT /api/positions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/positions/:id ───────────────────────────────────────────────
app.delete('/api/positions/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM positions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Position not found' });

    db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/positions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/trades ────────────────────────────────────────────────────────
app.post('/api/trades', (req, res) => {
  try {
    const { position_id, trade_date, trade_type, shares, price_eur, broker_fee_eur, notes } = req.body;

    if (!position_id || !trade_date || !trade_type || !shares || !price_eur) {
      return res.status(400).json({ error: 'position_id, trade_date, trade_type, shares, and price_eur are required' });
    }

    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(position_id);
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const result = db.prepare(
      `INSERT INTO trades (position_id, trade_date, trade_type, shares, price_eur, broker_fee_eur, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(position_id, trade_date, trade_type, shares, price_eur, broker_fee_eur || 0, notes || '');

    const allTrades = db.prepare('SELECT * FROM trades WHERE position_id = ? ORDER BY trade_date ASC').all(position_id);

    let totalShares = 0;
    let totalCost = 0;
    for (const trade of allTrades) {
      if (trade.trade_type === 'Buy') {
        totalCost += trade.shares * trade.price_eur + (trade.broker_fee_eur || 0);
        totalShares += trade.shares;
      } else if (trade.trade_type === 'Sell') {
        if (totalShares > 0) {
          totalCost -= trade.shares * (totalCost / totalShares);
        }
        totalShares -= trade.shares;
      }
    }
    if (totalShares < 0) totalShares = 0;
    const newAvgCost = totalShares > 0 ? totalCost / totalShares : 0;
    db.prepare('UPDATE positions SET shares = ?, avg_cost_eur = ? WHERE id = ?').run(totalShares, newAvgCost, position_id);

    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(trade);
  } catch (err) {
    console.error('POST /api/trades error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/trades/:positionId ─────────────────────────────────────────────
app.get('/api/trades/:positionId', (req, res) => {
  try {
    const trades = db.prepare('SELECT * FROM trades WHERE position_id = ? ORDER BY trade_date DESC, created_at DESC').all(req.params.positionId);
    res.json(trades);
  } catch (err) {
    console.error('GET /api/trades/:positionId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/prices/refresh ─────────────────────────────────────────────────
app.get('/api/prices/refresh', async (req, res) => {
  try {
    clearCache();
    const positions = db.prepare('SELECT ticker FROM positions').all();
    const tickers = ['EURUSD=X', ...positions.map(p => p.ticker)];
    const prices = await getPrices([...new Set(tickers)]);
    res.json({ success: true, prices });
  } catch (err) {
    console.error('GET /api/prices/refresh error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/search?q= ──────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q || q.length < 1) return res.json([]);
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 8000,
    });
    const quotes = response.data?.quotes || [];
    const results = quotes
      .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .map(q => ({
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || q.exchange || '',
        type: q.quoteType,
      }));
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.json([]);
  }
});

// ─── GET /api/sectors ────────────────────────────────────────────────────────
app.get('/api/sectors', (req, res) => {
  try {
    const sectors = db.prepare('SELECT * FROM sectors ORDER BY order_index').all();
    res.json(sectors);
  } catch (err) {
    console.error('GET /api/sectors error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend in production
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Portfolio Tracker running on http://localhost:${PORT}`);
});
