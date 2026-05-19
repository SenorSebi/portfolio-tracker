import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import { getPrices, clearCache } from './priceService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
