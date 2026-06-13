import React from 'react'
import { Sector, PriceData, Position, DcaZone, UpcomingEvent, MoverReport } from '../types'
import EventBadge from './EventBadge'
import MoverReports from './MoverReports'

interface OverviewListProps {
  sectors: Sector[]
  prices: Record<string, PriceData>
  eurUsdRate: number
  events?: Record<string, UpcomingEvent[]>
  movers?: MoverReport[]
}

type Status = 'alarm' | 'kaufzone' | 'implan' | 'nozone' | 'noprice'

interface Row {
  position: Position
  sectorName: string
  priceEur: number | null
  nearestZone: DcaZone | null
  distancePct: number | null
  status: Status
  sortScore: number
}

function fmt2(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildRows(sectors: Sector[], prices: Record<string, PriceData>, eurUsdRate: number): Row[] {
  const rows: Row[] = []

  for (const sector of sectors) {
    for (const position of sector.positions || []) {
      const pd = prices[position.ticker]
      const priceEur = pd && pd.priceUsd > 0 ? pd.priceUsd / eurUsdRate : null

      let nearestZone: DcaZone | null = null
      let distancePct: number | null = null
      let status: Status = 'noprice'
      let sortScore = 10000

      if (priceEur !== null) {
        if (position.dca_zones.length === 0) {
          status = 'nozone'
          sortScore = 9000
        } else {
          const sorted = [...position.dca_zones].sort((a, b) => a.price_eur - b.price_eur)
          const lowestZone = sorted[0]

          if (priceEur < lowestZone.price_eur) {
            // Below support — ALARM
            distancePct = (priceEur - lowestZone.price_eur) / lowestZone.price_eur * 100
            nearestZone = lowestZone
            status = 'alarm'
            sortScore = distancePct - 1000 // most below = lowest score = first
          } else {
            // Find the zone we are closest to from above
            let best: DcaZone | null = null
            let bestDist = Infinity
            for (const zone of sorted) {
              const d = (priceEur - zone.price_eur) / zone.price_eur * 100
              if (d >= 0 && d < bestDist) { bestDist = d; best = zone }
            }
            nearestZone = best
            distancePct = bestDist
            status = bestDist <= 5 ? 'kaufzone' : 'implan'
            sortScore = distancePct // ascending: closest zone first
          }
        }
      }

      rows.push({ position, sectorName: sector.name, priceEur, nearestZone, distancePct, status, sortScore })
    }
  }

  return rows.sort((a, b) => a.sortScore - b.sortScore)
}

const STATUS_CFG: Record<Status, { label: string; cls: string }> = {
  alarm:    { label: '🔴 ALARM',    cls: 'bg-red-50 text-red-700 border-red-200' },
  kaufzone: { label: '🟡 KAUFZONE', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  implan:   { label: '🟢 IM PLAN',  cls: 'bg-green-50 text-green-700 border-green-200' },
  nozone:   { label: '— KEINE ZONE', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  noprice:  { label: '⏳ KEIN KURS', cls: 'bg-gray-100 text-gray-400 border-gray-200' },
}

export default function OverviewList({ sectors, prices, eurUsdRate, events = {}, movers = [] }: OverviewListProps) {
  const rows = buildRows(sectors, prices, eurUsdRate)

  const alarmCount    = rows.filter(r => r.status === 'alarm').length
  const kaufzoneCount = rows.filter(r => r.status === 'kaufzone').length

  return (
    <div>
      {/* Sharp daily movers (>15%) with explanatory news */}
      <MoverReports movers={movers} />

      {/* Summary chips */}
      {(alarmCount > 0 || kaufzoneCount > 0) && (
        <div className="flex gap-3 mb-4">
          {alarmCount > 0 && (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
              🔴 {alarmCount} Alarm{alarmCount > 1 ? 's' : ''}
            </span>
          )}
          {kaufzoneCount > 0 && (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              🟡 {kaufzoneCount} Kaufzone{kaufzoneCount > 1 ? 'n' : ''}
            </span>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Position</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Sektor</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Termin</th>
              <th className="text-right px-4 py-3">Kurs</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Nächste Zone</th>
              <th className="text-right px-4 py-3">Abstand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ position, sectorName, priceEur, nearestZone, distancePct, status }) => {
              const cfg = STATUS_CFG[status]
              const isWatchlist = position.position_type === 'Watchlist' || position.shares === 0
              return (
                <tr key={position.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    {isWatchlist && (
                      <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                        WL
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-gray-900">{position.ticker}</span>
                    <span className="ml-2 text-gray-400 text-xs hidden sm:inline">{position.company_name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{sectorName}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {(() => {
                      const evs = events[position.ticker] || []
                      if (evs.length === 0) return <span className="text-gray-300">—</span>
                      return (
                        <div className="flex items-center gap-1">
                          <EventBadge event={evs[0]} />
                          {evs.length > 1 && (
                            <span className="text-xs text-gray-400">+{evs.length - 1}</span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {priceEur !== null ? `€${fmt2(priceEur)}` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {nearestZone ? (
                      <div>
                        <span className="font-medium text-gray-700">€{fmt2(nearestZone.price_eur)}</span>
                        {nearestZone.label && <div className="text-xs text-gray-400">{nearestZone.label}</div>}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {distancePct !== null ? (
                      <span className={`font-bold ${
                        distancePct < 0 ? 'text-red-600' : distancePct <= 5 ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {distancePct >= 0 ? '+' : ''}{distancePct.toFixed(1)}%
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
