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

// ─── Migration v3: Quantum Comp sector + positions ───────────────────────────
const v3ran = db.prepare("SELECT id FROM migrations WHERE name = 'v3_quantum_sector'").get();
if (!v3ran) {
  const insertPosition = db.prepare(
    `INSERT INTO positions (sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDca = db.prepare('INSERT INTO dca_zones (position_id, price_eur, label) VALUES (?, ?, ?)');

  const migrateV3 = db.transaction(() => {
    const sector = db.prepare('INSERT INTO sectors (name, description, order_index) VALUES (?, ?, ?)').run('Quantum Comp', '', 5);
    const sid = sector.lastInsertRowid;

    const add = (ticker, name, type, target, stopLoss, notes, zones) => {
      const r = insertPosition.run(sid, ticker, name, type, 0, 0, target || 0, stopLoss || null, notes);
      for (const z of zones) if (z.priceEur > 0) insertDca.run(r.lastInsertRowid, z.priceEur, z.label);
    };

    add('IONQ', 'IonQ Inc.', 'Watchlist', 26.00, 22.10,
      'Stärkster Quantum-Pure-Play, SkyWater-Merger ausstehend. Einstieg erst nach ~50% Kursrückgang vertretbar. Nächster Katalysator: Merger-Closing Q2/Q3 2026.',
      [{ label: 'Erstposition', priceEur: 26.00 }, { label: 'Nachkauf 1', priceEur: 22.50 }, { label: 'Nachkauf 2', priceEur: 17.50 }]);

    add('QBTS', 'D-Wave Quantum Inc.', 'Watchlist', 11.50, 9.78,
      'Annealing-Nische mit ersten echten Industriekunden. Bookings-Explosion positiv, aber Revenue-Base winzig. Nur im Extremszenario Einstieg vertretbar.',
      [{ label: 'Erstposition', priceEur: 11.50 }, { label: 'Nachkauf 1', priceEur: 9.80 }, { label: 'Nachkauf 2', priceEur: 7.80 }]);

    add('RGTI', 'Rigetti Computing Inc.', 'Watchlist', 4.50, 0,
      'MEIDEN. P/S ~870x, technologisch zwischen den Stühlen, CEO-Wechsel. Kein aktiver Kauf bis fundamentale Normalisierung und strukturelle Differenzierung erkennbar.',
      [{ label: 'Erstcheck', priceEur: 4.50 }, { label: 'Absoluter Boden', priceEur: 2.60 }]);

    add('QUBT', 'Quantum Computing Inc.', 'Watchlist', 0, 0,
      'MEIDEN. Kein proprietäres Hardware-Fundament, P/S >600x, Software-Only-Ansatz ohne Moat. Pets.com-Kandidat.',
      []);

    add('GOOGL', 'Alphabet Inc.', 'Watchlist', 290.00, 246.50,
      'Beste Quantum-Infrastruktur im Mag7. Willow-Chip mit verifizierbarem Vorteil. Einstieg bei AI-Korrektur. Quantum ist kostenlose Option on top.',
      [{ label: 'Erstposition', priceEur: 290.00 }, { label: 'Nachkauf 1', priceEur: 250.00 }, { label: 'Nachkauf 2', priceEur: 200.00 }]);

    add('NVDA', 'NVIDIA Corporation', 'Watchlist', 165.00, 140.25,
      'AI+Quantum Infrastrukturmonopol. NVQLink macht NVIDIA zum OS der Hybrid-Computing-Ära. Earnings heute Abend. Kaufzonen ~15-40% unter aktuellen Kursen.',
      [{ label: 'Erstposition', priceEur: 165.00 }, { label: 'Nachkauf 1', priceEur: 140.00 }, { label: 'Nachkauf 2', priceEur: 115.00 }]);

    add('MSFT', 'Microsoft Corporation', 'Watchlist', 340.00, 289.00,
      'Azure Quantum = Hardware-agnostischer Gewinner. Majorana-1 Wildcard. Aktuell günstiger als Peers, Capex-Risiko beobachten. Erste Kaufzone nahe.',
      [{ label: 'Erstposition', priceEur: 340.00 }, { label: 'Nachkauf 1', priceEur: 310.00 }, { label: 'Nachkauf 2', priceEur: 270.00 }]);

    add('IBM', 'International Business Machines', 'Watchlist', 194.00, 164.90,
      'Tiefste Enterprise-Quantum-Pipeline, 210x Genauigkeitsdurchbruch Mai 2026. Bereits -25% YTD, nähert sich Kaufzone. Quantum Advantage Demo H2 2026 als Katalysator.',
      [{ label: 'Erstposition', priceEur: 194.00 }, { label: 'Nachkauf 1', priceEur: 172.00 }, { label: 'Nachkauf 2', priceEur: 147.00 }]);

    add('SKYT', 'SkyWater Technology', 'Watchlist', 0, 0,
      'Merger-Target von IonQ ($1,8Mrd.). Kein eigenständiger Investment-Case. Aktionäre haben zugestimmt, Closing Q2/Q3 2026 ausstehend.',
      []);

    db.prepare("INSERT INTO migrations (name) VALUES ('v3_quantum_sector')").run();
  });

  migrateV3();
  console.log('Migration v3: Quantum Comp sector created with 9 positions.');
}

// ─── Migration v4: Cybersecurity sector + positions ─────────────────────────
const v4ran = db.prepare("SELECT id FROM migrations WHERE name = 'v4_cybersecurity_sector'").get();
if (!v4ran) {
  const insertPosition = db.prepare(
    `INSERT INTO positions (sector_id, ticker, company_name, position_type, shares, avg_cost_eur, target_size_eur, stop_loss_eur, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDca = db.prepare('INSERT INTO dca_zones (position_id, price_eur, label) VALUES (?, ?, ?)');

  const migrateV4 = db.transaction(() => {
    const sector = db.prepare('INSERT INTO sectors (name, description, order_index) VALUES (?, ?, ?)').run('Cybersecurity', '', 6);
    const sid = sector.lastInsertRowid;

    const add = (ticker, name, type, target, stopLoss, notes, zones) => {
      const r = insertPosition.run(sid, ticker, name, type, 0, 0, target || 0, stopLoss || null, notes);
      for (const z of zones) insertDca.run(r.lastInsertRowid, z.priceEur, z.label);
    };

    add('CRWD', 'CrowdStrike Holdings, Inc.', 'Core', 620, 370,
      'Stärkste Fundamentals im Sektor: $5,25 Mrd. ARR, $1,24 Mrd. FCF, erstmals GAAP-positiv. Organische Plattform-Architektur als Differenziator. Derzeit am ATH – warten auf Rücksetzer in Kaufzonen. Nächster Katalysator: Q1 FY27 Earnings ~Juni 2026.',
      [{ label: 'Erstposition', priceEur: 460 }, { label: 'Nachkauf 1', priceEur: 375 }, { label: 'Nachkauf 2', priceEur: 310 }]);

    add('PANW', 'Palo Alto Networks, Inc.', 'Core', 280, 175,
      'Platformization-Leader, CyberArk-Übernahme $25 Mrd. abgeschlossen Feb. 2026. NGS-ARR +33%. Derzeit am ATH – halbe Erstposition möglich, Rest nach Q3-Earnings-Reaktion 2. Juni 2026.',
      [{ label: 'Erstposition', priceEur: 210 }, { label: 'Nachkauf 1', priceEur: 176 }, { label: 'Nachkauf 2', priceEur: 148 }]);

    add('ZS', 'Zscaler, Inc.', 'Core', 220, 115,
      'Zero-Trust-Leader, 23% Revenue-Wachstum, Net Cash $1,8 Mrd. Narrativer Überverkauf. Q3-Earnings heute 26. Mai. Symmetry Systems M&A angekündigt. Erstposition aufteilen: 50% vor / 50% nach Earnings.',
      [{ label: 'Erstposition', priceEur: 145 }, { label: 'Nachkauf 1', priceEur: 112 }, { label: 'Nachkauf 2', priceEur: 95 }]);

    add('NET', 'Cloudflare, Inc.', 'Core', 240, 132,
      'AI-Gateway + Cybersecurity-Infrastruktur. 29% Wachstum, Non-GAAP profitabel. Derzeit über Kaufzone. Nächste Earnings 30. Juli 2026. Rücksetzer abwarten.',
      [{ label: 'Erstposition', priceEur: 158 }, { label: 'Nachkauf 1', priceEur: 140 }, { label: 'Nachkauf 2', priceEur: 118 }]);

    add('FTNT', 'Fortinet, Inc.', 'Core', 95, 55,
      'Profitabelster Sektor-Wert: GAAP EPS $0,72, FCF $1 Mrd. in Q1 allein. Kurs korrigiert trotz Rekord-Fundamentals. Zone 1 aktiv. Erstposition jetzt vertretbar. Nächste Earnings ~August 2026.',
      [{ label: 'Erstposition', priceEur: 66 }, { label: 'Nachkauf 1', priceEur: 57 }, { label: 'Nachkauf 2', priceEur: 48 }]);

    add('S', 'SentinelOne, Inc.', 'Speculative', 18, 8.50,
      'AI-nativer Endpoint-Security, erstmals profitabel (Non-GAAP). M&A-Ziel (Cisco/IBM). 3,5x Forward Revenue = günstigste Bewertung im Sektor. Q1 FY27 Earnings 28. Mai 2026. Vor Event nur halbe Erstposition.',
      [{ label: 'Erstposition', priceEur: 11 }, { label: 'Nachkauf 1', priceEur: 9.20 }, { label: 'Nachkauf 2', priceEur: 7.30 }]);

    add('OKTA', 'Okta, Inc.', 'Watchlist', 100, 42,
      'Einziger GAAP-profitabler Identity-Pure-Play. FCF-Marge 30%, $2,55 Mrd. Cash, Buyback läuft. AI-Agent-Identität als nächste Wachstumswelle. Derzeit über Kaufzone. Earnings 28. Mai 2026 abwarten. Hauptrisiko: PANW/CyberArk als Plattform-Konkurrent.',
      [{ label: 'Erstposition', priceEur: 54 }, { label: 'Nachkauf 1', priceEur: 46 }, { label: 'Nachkauf 2', priceEur: 38 }]);

    db.prepare("INSERT INTO migrations (name) VALUES ('v4_cybersecurity_sector')").run();
  });

  migrateV4();
  console.log('Migration v4: Cybersecurity sector created with 7 positions.');
}

// ─── Migration v5: thesis, exit_rules, journal tables ────────────────────────
const v5ran = db.prepare("SELECT id FROM migrations WHERE name = 'v5_thesis_exit_journal'").get();
if (!v5ran) {
  const migrateV5 = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS thesis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL UNIQUE,
        bucket TEXT DEFAULT '',
        "case" TEXT DEFAULT '',
        right_if TEXT DEFAULT '',
        wrong_if TEXT DEFAULT '',
        updated_at TEXT DEFAULT current_timestamp
      );

      CREATE TABLE IF NOT EXISTS exit_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL UNIQUE,
        stop_loss_pct REAL,
        take_profit_rules TEXT DEFAULT '[]',
        thesis_break_condition TEXT DEFAULT '',
        updated_at TEXT DEFAULT current_timestamp
      );

      CREATE TABLE IF NOT EXISTS journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT,
        action TEXT NOT NULL,
        note TEXT DEFAULT '',
        luck_or_skill TEXT,
        rule_followed INTEGER DEFAULT 1,
        unplanned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT current_timestamp
      );
    `);
    db.prepare("INSERT INTO migrations (name) VALUES ('v5_thesis_exit_journal')").run();
  });
  migrateV5();
  console.log('Migration v5: thesis, exit_rules, and journal tables created.');
}

export default db;
