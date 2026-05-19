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

export default db;
