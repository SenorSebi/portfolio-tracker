# Portfolio Tracker

Express + better-sqlite3 backend (`backend/`), React/Vite/Tailwind frontend (`frontend/`).
Deployed on Railway; the live SQLite file sits on a Railway volume (`DB_PATH` env var,
local default `backend/portfolio.db`, git-ignored).

## Arbeitsweise

- Gearbeitet wird direkt auf `main`, keine Feature-Branches oder PRs.
- **Push auf `main` = Deploy auf Railway.** Vor jedem Push prüfen, dass der Build durchläuft.
- Lokaler Klon: `~/Library/CloudStorage/GoogleDrive-sebijilch@gmail.com/Meine Ablage/Finance Claude/portfolio-tracker`
  (`npm run install:all`, dann `npm run dev`).

## Datenhaltung

Alle Daten liegen in SQLite (`backend/database.js`). Inhaltliche Datenänderungen (Positionen, Zonen,
Thesen, Journal) werden bisher als **nummerierte, einmalige Migrationen** in `backend/database.js`
eingebaut (`vN_<name>`, eingetragen in Tabelle `migrations`, in `db.transaction`) und gehen per
Deploy auf Railway live. Nächste freie Nummer: siehe letzte `INSERT INTO migrations` in `database.js`.
Die REST-API (`backend/server.js`) macht dieselben Änderungen zur Laufzeit.

Wo die Übergabe-Aktionen landen:
- `upsert` → `positions` (ticker, company_name, sector_id, position_type, target_size_eur,
  stop_loss_eur, notes), `dca_zones` (price_eur, label – komplett ersetzt), `thesis` (bucket u.a.),
  `exit_rules` (thesis_break_condition, Stops). API: `POST/PUT /api/positions`, `PUT /api/thesis/:ticker`,
  `PUT /api/exit-rules/:ticker`.
- `trade` → `trades` (trade_type `Buy|Sell`, shares, price_eur, broker_fee_eur, notes); danach werden
  `positions.shares`/`avg_cost_eur` aus allen Trades neu berechnet (Logik in `POST /api/trades`;
  in einer Migration dieselbe Rechnung nachbilden).
- `remove` → `DELETE` auf `positions`; **Achtung:** löscht per `ON DELETE CASCADE` auch Trades und
  Zonen – es gibt keinen „geschlossen"-Status, Historie geht verloren.
- `note` → `journal` (ticker oder `NULL` für PORTFOLIO, action, note). API: `POST /api/journal`.

Status (IM PLAN / KAUFZONE / ALARM / WATCHLIST) wird **nicht gespeichert**, sondern im Frontend
aus Kurs + Zonen berechnet (`frontend/src/lib/positionStatus.ts`).

## Übergaben aus Finance-Chats

Finance-Chats legen Übergabe-Dateien im Google-Drive-Ordner ab:
`~/Library/CloudStorage/GoogleDrive-sebijilch@gmail.com/Meine Ablage/Finance Claude/`
- `eingang/` — neue, noch nicht eingebaute Übergaben
- `archiv/` — eingebaute Übergaben (nie löschen)
- `UEBERGABE-PROTOKOLL.md` — Format und Regeln (Teil B gilt für Code)

Bei „Übergaben einbauen" oder `/uebergaben`: zuerst `UEBERGABE-PROTOKOLL.md` lesen, dann
nach Teil B vorgehen. Immer erst Vorschau, dann nach OK anwenden. Nie raten bei Konflikten.
Nicht von selbst den Eingang abarbeiten — nur auf Kommando.

In Cloud-Sessions (kein Mac-Pfad vorhanden) denselben Ordner über den Google-Drive-Connector lesen:
Stammordner `1qi5eIKOKdA6GFRBbyXf527eZkkSUlYFZ`, `eingang/` `1GGmNCPlRA6VXKigFjyl41KHIsRIb8pwf`,
`archiv/` `1DzqiKRgxiJlfzj47w1lb5P3M1vdjG6an`.
