import { Position, DcaZone } from '../types'

export type PositionStatus = 'watchlist' | 'alarm' | 'kaufzone' | 'implan' | 'nozone' | 'noprice'

export interface StatusResult {
  status: PositionStatus
  nearestZone: DcaZone | null
  distancePct: number | null // distance to nearest zone in %, negative = below support
  sortScore: number // lower = more urgent; used for overview ordering
}

// Single source of truth for a position's buy-zone status.
// `watchlistAware: true` lets the caller surface a dedicated WATCHLIST state
// (PositionCard); the overview keeps the zone status and shows WL separately.
export function computeStatus(
  position: Position,
  priceEur: number | null,
  opts: { watchlistAware?: boolean } = {}
): StatusResult {
  const isWatchlist = position.position_type === 'Watchlist' || position.shares === 0
  if (opts.watchlistAware && isWatchlist) {
    return { status: 'watchlist', nearestZone: null, distancePct: null, sortScore: 8000 }
  }
  if (priceEur === null) {
    return { status: 'noprice', nearestZone: null, distancePct: null, sortScore: 10000 }
  }
  if (!position.dca_zones || position.dca_zones.length === 0) {
    return { status: 'nozone', nearestZone: null, distancePct: null, sortScore: 9000 }
  }

  const sorted = [...position.dca_zones].sort((a, b) => a.price_eur - b.price_eur)
  const lowestZone = sorted[0]

  if (priceEur < lowestZone.price_eur) {
    // Below support — ALARM. Most-below sorts first.
    const distancePct = ((priceEur - lowestZone.price_eur) / lowestZone.price_eur) * 100
    return { status: 'alarm', nearestZone: lowestZone, distancePct, sortScore: distancePct - 1000 }
  }

  // Closest zone from above.
  let best: DcaZone | null = null
  let bestDist = Infinity
  for (const zone of sorted) {
    const d = ((priceEur - zone.price_eur) / zone.price_eur) * 100
    if (d >= 0 && d < bestDist) {
      bestDist = d
      best = zone
    }
  }
  const status: PositionStatus = bestDist <= 5 ? 'kaufzone' : 'implan'
  return { status, nearestZone: best, distancePct: bestDist, sortScore: bestDist }
}

// Label + Tailwind colour classes per status (the `border` utility is added by the consumer).
export const STATUS_META: Record<PositionStatus, { label: string; cls: string }> = {
  alarm:     { label: '🔴 ALARM',     cls: 'bg-red-50 text-danger border-red-200' },
  kaufzone:  { label: '🟡 KAUFZONE',  cls: 'bg-yellow-50 text-warning border-yellow-200' },
  implan:    { label: '🟢 IM PLAN',   cls: 'bg-green-50 text-success border-green-200' },
  watchlist: { label: '👁 WATCHLIST', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  nozone:    { label: '— KEINE ZONE', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  noprice:   { label: '⏳ KEIN KURS', cls: 'bg-gray-100 text-gray-400 border-gray-200' },
}
