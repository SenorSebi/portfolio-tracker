import React, { useState } from 'react'
import axios from 'axios'
import { Position, PriceData, Sector, Thesis, ExitRules, Alert } from '../types'
import AddPositionModal from './AddPositionModal'
import TradeLogModal from './TradeLogModal'
import ThesisPanel from './ThesisPanel'
import ExitPanel from './ExitPanel'

interface PositionCardProps {
  position: Position
  priceData: PriceData | undefined
  eurUsdRate: number
  onRefresh: () => void
  sectors: Sector[]
  alerts: Alert[]
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmt4(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export default function PositionCard({
  position,
  priceData,
  eurUsdRate,
  onRefresh,
  sectors,
  alerts,
}: PositionCardProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [thesis, setThesis] = useState<Thesis | null>(position.thesis)
  const [exitRules, setExitRules] = useState<ExitRules | null>(position.exit_rules)

  const priceEur = priceData && priceData.priceUsd > 0 ? priceData.priceUsd / eurUsdRate : null
  const priceUsd = priceData && priceData.priceUsd > 0 ? priceData.priceUsd : null
  const changePercent = priceData ? priceData.changePercent : null

  const currentValue = priceEur !== null ? position.shares * priceEur : null
  const totalInvested = position.shares * position.avg_cost_eur
  const gv = currentValue !== null ? currentValue - totalInvested : null
  const gvPercent = totalInvested > 0 && gv !== null ? (gv / totalInvested) * 100 : null

  const targetProgress =
    position.target_size_eur > 0 && currentValue !== null
      ? Math.min((currentValue / position.target_size_eur) * 100, 100)
      : 0

  const hasActiveAlert = alerts.some(a => a.ticker === position.ticker)

  const isWatchlist = position.position_type === 'Watchlist' || position.shares === 0
  let statusLabel = ''
  let statusClass = ''

  if (isWatchlist) {
    statusLabel = '👁 WATCHLIST'
    statusClass = 'bg-gray-100 text-gray-600 border border-gray-200'
  } else if (priceEur !== null && position.dca_zones.length > 0) {
    const nearestZone = position.dca_zones.find(
      zone => Math.abs(priceEur - zone.price_eur) / zone.price_eur <= 0.05
    )
    const lowestZonePrice = Math.min(...position.dca_zones.map(z => z.price_eur))

    if (nearestZone) {
      statusLabel = '🟡 KAUFZONE'
      statusClass = 'bg-yellow-50 text-warning border border-yellow-200'
    } else if (priceEur < lowestZonePrice) {
      statusLabel = '🔴 ALARM'
      statusClass = 'bg-red-50 text-danger border border-red-200'
    } else {
      statusLabel = '🟢 IM PLAN'
      statusClass = 'bg-green-50 text-success border border-green-200'
    }
  } else if (priceEur !== null) {
    statusLabel = '🟢 IM PLAN'
    statusClass = 'bg-green-50 text-success border border-green-200'
  } else {
    statusLabel = '⏳ KEIN KURS'
    statusClass = 'bg-gray-100 text-gray-500 border border-gray-200'
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    try {
      await axios.delete(`/api/positions/${position.id}`)
      onRefresh()
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const positionTypeBadge = {
    Core: 'bg-blue-100 text-blue-700',
    Speculative: 'bg-purple-100 text-purple-700',
    Watchlist: 'bg-gray-100 text-gray-600',
  }[position.position_type]

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
        {/* Card Header */}
        <div className="p-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900">{position.ticker}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${positionTypeBadge}`}>
                  {position.position_type}
                </span>
                {hasActiveAlert && (
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 animate-pulse">
                    ALERT
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate mt-0.5">{position.company_name}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          {/* Live Price */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              {priceEur !== null ? (
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">€{fmt4(priceEur)}</span>
                  <span className="text-xs text-gray-400">${priceUsd ? fmt4(priceUsd) : '—'}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Kein Kurs verfügbar</span>
              )}
            </div>
            {changePercent !== null && (
              <span className={`text-sm font-medium ${changePercent >= 0 ? 'text-success' : 'text-danger'}`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Holdings */}
        <div className="p-4 pb-3 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Investiert</p>
              <p className="font-semibold text-gray-900">€{fmt(totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Stück</p>
              <p className="font-semibold text-gray-900">{position.shares}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Einstand</p>
              <p className="font-semibold text-gray-900">
                {position.avg_cost_eur > 0 ? `€${fmt(position.avg_cost_eur)}` : '—'}
              </p>
            </div>
          </div>

          {currentValue !== null && position.shares > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Aktuell</p>
                <p className="font-semibold text-gray-900">€{fmt(currentValue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">G/V</p>
                <p className={`font-bold ${gv !== null && gv >= 0 ? 'text-success' : 'text-danger'}`}>
                  {gv !== null && gv >= 0 ? '+' : ''}€{gv !== null ? fmt(gv) : '—'}
                  {gvPercent !== null && (
                    <span className="text-xs ml-1">({gvPercent >= 0 ? '+' : ''}{gvPercent.toFixed(2)}%)</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Target Progress */}
        {position.target_size_eur > 0 && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Ziel: €{fmt(position.target_size_eur)}</span>
              <span className="font-medium text-gray-700">{targetProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-accent rounded-full h-2 transition-all duration-500"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* DCA Zones */}
        {position.dca_zones.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">DCA Zonen</p>
            <div className="space-y-1.5">
              {position.dca_zones.map((zone, i) => {
                const isNearest =
                  priceEur !== null &&
                  Math.abs(priceEur - zone.price_eur) / zone.price_eur <= 0.05
                const isBelow = priceEur !== null && priceEur < zone.price_eur

                return (
                  <div key={zone.id ?? i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isNearest ? 'bg-warning' : isBelow ? 'bg-danger' : 'bg-gray-300'
                      }`} />
                      <span className="text-xs text-gray-600">{zone.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800">€{zone.price_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {isNearest && (
                        <span className="text-xs font-medium text-warning bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5">
                          NÄCHSTE
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {position.notes && (
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notizen</p>
            <p className="text-xs text-gray-600 leading-relaxed">{position.notes}</p>
          </div>
        )}

        {/* Stop Loss */}
        {position.stop_loss_eur !== null && (
          <div className="px-4 py-2 border-b border-gray-100">
            <span className="text-xs text-danger font-medium">
              Stop-Loss: €{fmt(position.stop_loss_eur)}
            </span>
          </div>
        )}

        {/* Thesis Panel */}
        <ThesisPanel
          ticker={position.ticker}
          thesis={thesis}
          onUpdate={setThesis}
        />

        {/* Exit Panel */}
        <ExitPanel
          ticker={position.ticker}
          exitRules={exitRules}
          avgCostEur={position.avg_cost_eur}
          priceEur={priceEur}
          onUpdate={setExitRules}
        />

        {/* Actions */}
        <div className="p-4 pt-3 mt-auto flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bearbeiten
          </button>
          <button
            onClick={() => setShowTradeModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-dark rounded-lg px-3 py-2 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Trade
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-danger bg-red-50 hover:bg-red-100'
            } disabled:opacity-60`}
            title={confirmDelete ? 'Erneut klicken zum Bestätigen' : 'Position löschen'}
          >
            {deleting ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            {confirmDelete ? 'Sicher?' : ''}
          </button>
        </div>
      </div>

      {showEditModal && (
        <AddPositionModal
          sectors={sectors}
          defaultSectorId={position.sector_id}
          initialData={{
            ticker: position.ticker,
            company_name: position.company_name,
            sector_id: position.sector_id,
            position_type: position.position_type,
            shares: position.shares,
            avg_cost_eur: position.avg_cost_eur,
            target_size_eur: position.target_size_eur,
            stop_loss_eur: position.stop_loss_eur,
            notes: position.notes,
            dca_zones: position.dca_zones,
          }}
          editId={position.id}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false)
            onRefresh()
          }}
        />
      )}

      {showTradeModal && (
        <TradeLogModal
          position={position}
          hasActiveAlert={hasActiveAlert}
          onClose={() => setShowTradeModal(false)}
          onSave={() => {
            setShowTradeModal(false)
            onRefresh()
          }}
        />
      )}
    </>
  )
}
