import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'portfolio.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_id INTEGER REFERENCES sectors(id),
    ticker TEXT NOT NULL,
    company_name TEXT NOT NULL,
    position_type TEXT DEFAULT 'Core',
    shares REAL DEFAULT 0,
    avg_cost_eur REAL DEFAULT 0,
    target_size_eur REAL DEFAULT 0,
    stop_loss_eur REAL,
    notes TEXT,
    created_at TEXT DEFAULT current_timestamp
  );

  CREATE TABLE IF NOT EXISTS dca_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
    price_eur REAL NOT NULL,
    label TEXT
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
    trade_date TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    shares REAL NOT NULL,
    price_eur REAL NOT NULL,
    broker_fee_eur REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT current_timestamp
  );
`);

const sectorCount = db.prepare('SELECT COUNT(*) as cnt FROM sectors').get();
if (sectorCount.cnt === 0) {
  const insertSector = db.prepare(
    'INSERT INTO sectors (name, description, order_index) VALUES (?, ?, ?)'
  );
  const insertPosition = db.prepare(
    `INSERT INTO positions (sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDca = db.prepare(
    'INSERT INTO dca_zones (position_id, price_eur, label) VALUES (?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    const s1 = insertSector.run('AI Infrastructure', '', 1);
    const s2 = insertSector.run('Industrial / Energy', '', 2);
    const s3 = insertSector.run('Biotech', '', 3);
    insertSector.run('Freies Segment', '', 4);

    const etn = insertPosition.run(s1.lastInsertRowid, 'ETN', 'Eaton Corp', 'Core', 0, 0, 5000, null, 'Bucket A - AI power infrastructure, 15% stop-loss');
    insertDca.run(etn.lastInsertRowid, 380, 'Zone 1');
    insertDca.run(etn.lastInsertRowid, 340, 'Zone 2');
    insertDca.run(etn.lastInsertRowid, 290, 'Zone 3');

    const tt = insertPosition.run(s1.lastInsertRowid, 'TT', 'Trane Technologies', 'Core', 0, 0, 4000, null, '');
    insertDca.run(tt.lastInsertRowid, 290, 'Zone 1');
    insertDca.run(tt.lastInsertRowid, 250, 'Zone 2');
    insertDca.run(tt.lastInsertRowid, 210, 'Zone 3');

    const bntx = insertPosition.run(s3.lastInsertRowid, 'BNTX', 'BioNTech', 'Core', 25, 79.00, 5000, null, '');
    insertDca.run(bntx.lastInsertRowid, 71, 'Nachkauf 1');
    insertDca.run(bntx.lastInsertRowid, 62, 'Nachkauf 2');
    insertDca.run(bntx.lastInsertRowid, 54, 'Nachkauf 3');

    const crsp = insertPosition.run(s3.lastInsertRowid, 'CRSP', 'CRISPR Therapeutics', 'Core', 42, 46.00, 3500, null, '');
    insertDca.run(crsp.lastInsertRowid, 41, 'Nachkauf 1');
    insertDca.run(crsp.lastInsertRowid, 34, 'Nachkauf 2');

    const sdgr = insertPosition.run(s3.lastInsertRowid, 'SDGR', 'Schrödinger', 'Core', 68, 10.30, 1500, null, '');
    insertDca.run(sdgr.lastInsertRowid, 9.00, 'Nachkauf 1');
    insertDca.run(sdgr.lastInsertRowid, 7.30, 'Nachkauf 2');

    const mrna = insertPosition.run(s3.lastInsertRowid, 'MRNA', 'Moderna', 'Speculative', 8, 41.00, 700, null, '');
    insertDca.run(mrna.lastInsertRowid, 37, 'Nachkauf');

    const ntla = insertPosition.run(s3.lastInsertRowid, 'NTLA', 'Intellia Therapeutics', 'Watchlist', 0, 0, 0, null, '');
    insertDca.run(ntla.lastInsertRowid, 10.30, 'Erstcheck');
    insertDca.run(ntla.lastInsertRowid, 6.90, 'Absoluter Boden');

    const beam = insertPosition.run(s3.lastInsertRowid, 'BEAM', 'Beam Therapeutics', 'Watchlist', 0, 0, 0, null, '');
    insertDca.run(beam.lastInsertRowid, 22.30, 'Erstcheck');
    insertDca.run(beam.lastInsertRowid, 12.00, 'Absoluter Boden');
  });

  seedAll();
  console.log('Database seeded with initial data.');
}

// ─── Migration v2: Sector 1 positions update ────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE)`);

const alreadyRan = db.prepare("SELECT id FROM migrations WHERE name = 'v2_sector1_positions'").get();
if (!alreadyRan) {
  const insertPosition = db.prepare(
    `INSERT INTO positions (sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDca = db.prepare('INSERT INTO dca_zones (position_id, price_eur, label) VALUES (?, ?, ?)');
  const deleteDca = db.prepare('DELETE FROM dca_zones WHERE position_id = ?');
  const updatePosition = db.prepare(
    `UPDATE positions SET position_type=?, shares=?, avg_cost_eur=?, target_size_eur=?, stop_loss_eur=?, notes=? WHERE ticker=? AND sector_id=?`
  );

  const sector1 = db.prepare("SELECT id FROM sectors WHERE order_index = 1").get();
  if (sector1) {
    const s1 = sector1.id;

    const migrate = db.transaction(() => {
      // Upsert helper
      const upsert = (ticker, name, type, shares, cost, target, stopLoss, notes, zones) => {
        const existing = db.prepare('SELECT id FROM positions WHERE ticker = ? AND sector_id = ?').get(ticker, s1);
        let posId;
        if (existing) {
          updatePosition.run(type, shares, cost, target, stopLoss || null, notes, ticker, s1);
          posId = existing.id;
          deleteDca.run(posId);
        } else {
          const r = insertPosition.run(s1, ticker, name, type, shares, cost, target, stopLoss || null, notes);
          posId = r.lastInsertRowid;
        }
        for (const z of zones) insertDca.run(posId, z.priceEur, z.label);
      };

      upsert('TT', 'Trane Technologies', 'Watchlist', 0, 0, 0, 0,
        'HVAC/Datacenter-Kühlung, Rekord-Backlog $10,7Mrd. Stellar Energy Akquisition. Bucket A-Kandidat – noch keine Position. Q2 Earnings Juli 2026.',
        [{ label: 'Erstposition', priceEur: 387 }, { label: 'Nachkauf 1', priceEur: 337 }, { label: 'Nachkauf 2', priceEur: 290 }]
      );

      upsert('ETN', 'Eaton Corporation', 'Watchlist', 0, 0, 0, 0,
        'Energiemanagement/Power Infrastructure. Rekord Q1 2026. Noch keine Position – Erstposition bei aktuellem Kurs ~€327 möglich. Q2 Earnings 4. August 2026.',
        [{ label: 'Erstposition', priceEur: 327 }, { label: 'Nachkauf 1', priceEur: 288 }, { label: 'Nachkauf 2', priceEur: 250 }]
      );

      upsert('SDGR', 'Schrödinger Inc.', 'Speculative', 0, 0, 10.35, 8.80,
        'Physics+AI Plattform Molekülentwicklung. Kein Gewinn bis 2028. Cash $406M. Ajax-Exit-Upside, Bunsen-Launch. Max 3-5% Portfolio. NICHT Bucket A.',
        [{ label: 'Erstposition', priceEur: 10.35 }, { label: 'Nachkauf 1', priceEur: 8.75 }, { label: 'Nachkauf 2', priceEur: 7.40 }]
      );

      upsert('AMAT', 'Applied Materials', 'Watchlist', 0, 0, 330, 0,
        'Weltgrößter WFE-Anbieter. Record Q2, Advanced Packaging +50% 2026. NEXX-Akquisition. Warten auf Rücksetzer.',
        [{ label: 'Erstcheck-Zone', priceEur: 330 }, { label: 'Nachkauf 1', priceEur: 283 }, { label: 'Nachkauf 2', priceEur: 242 }]
      );

      upsert('KLAC', 'KLA Corporation', 'Watchlist', 0, 0, 1380, 0,
        'Monopol Chip-Inspektion/Metrologie. FY2025 Earnings +47%. Warten auf Rücksetzer. Q4 Earnings 30. Juli 2026.',
        [{ label: 'Erstcheck-Zone', priceEur: 1380 }, { label: 'Nachkauf 1', priceEur: 1185 }, { label: 'Nachkauf 2', priceEur: 1010 }]
      );

      upsert('AMKR', 'Amkor Technology', 'Watchlist', 0, 0, 58, 51,
        'OSAT #2 weltweit. Rekord Q1 2026 EPS +267%. Arizona Onshoring-Fab. $300M Buyback. Kaufzone aktiv.',
        [{ label: 'Erstposition', priceEur: 58 }, { label: 'Nachkauf 1', priceEur: 49 }, { label: 'Nachkauf 2', priceEur: 41 }]
      );

      upsert('ASX', 'ASE Technology Holding (ADR)', 'Watchlist', 0, 0, 23, 0,
        'Weltgrößter OSAT. P/E günstiger als Peers. Taiwan-Risiko begrenzt Gewichtung. Insider-Verkäufe beobachten. Q2 Earnings 23. Juli 2026.',
        [{ label: 'Erstcheck-Zone', priceEur: 23 }, { label: 'Nachkauf 1', priceEur: 19 }, { label: 'Nachkauf 2', priceEur: 15 }]
      );

      upsert('ONTO', 'Onto Innovation', 'Watchlist', 0, 0, 200, 0,
        'Mid-Cap Metrology/Inspektion. 2026 Wachstum >30%. Kurs +200% in 12M – warten auf Rücksetzer. Q2 Earnings ~Aug 2026.',
        [{ label: 'Erstcheck-Zone', priceEur: 200 }, { label: 'Nachkauf 1', priceEur: 169 }, { label: 'Nachkauf 2', priceEur: 139 }]
      );

      db.prepare("INSERT INTO migrations (name) VALUES ('v2_sector1_positions')").run();
    });

    migrate();
    console.log('Migration v2: Sector 1 positions updated.');
  }
}

export default db;
