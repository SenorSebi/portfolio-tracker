import React, { useState } from 'react'
import { Sector, PriceData, Alert } from '../types'
import PositionCard from './PositionCard'
import AddPositionModal from './AddPositionModal'

interface SectorViewProps {
  sector: Sector
  allSectors?: Sector[]
  prices: Record<string, PriceData>
  eurUsdRate: number
  onRefresh: () => void
  alerts?: Alert[]
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SectorView({ sector, allSectors, prices, eurUsdRate, onRefresh, alerts = [] }: SectorViewProps) {
  const sectors = allSectors || [sector]
  const [showAddModal, setShowAddModal] = useState(false)

  // Calculate sector totals
  let sectorInvested = 0
  let sectorCurrentValue = 0

  for (const position of sector.positions || []) {
    sectorInvested += position.shares * position.avg_cost_eur
    const priceData = prices[position.ticker]
    if (priceData && priceData.priceUsd > 0 && position.shares > 0) {
      sectorCurrentValue += position.shares * (priceData.priceUsd / eurUsdRate)
    } else {
      sectorCurrentValue += position.shares * position.avg_cost_eur
    }
  }

  const sectorGV = sectorCurrentValue - sectorInvested
  const sectorGVPercent = sectorInvested > 0 ? (sectorGV / sectorInvested) * 100 : 0
  const isPositive = sectorGV >= 0

  const activePositions = (sector.positions || []).filter(p => p.shares > 0).length
  const watchlistPositions = (sector.positions || []).filter(p => p.position_type === 'Watchlist' || p.shares === 0).length

  return (
    <div>
      {/* Sector Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{sector.name}</h2>
            {sector.description && (
              <p className="text-sm text-gray-500 mt-0.5">{sector.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                {(sector.positions || []).length} Positionen
              </span>
              {activePositions > 0 && (
                <span className="text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                  {activePositions} aktiv
                </span>
              )}
              {watchlistPositions > 0 && (
                <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                  {watchlistPositions} Watchlist
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            {sectorInvested > 0 && (
              <>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Investiert</p>
                  <p className="text-base font-semibold text-gray-900">€{fmt(sectorInvested)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Aktuell</p>
                  <p className="text-base font-semibold text-gray-900">€{fmt(sectorCurrentValue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">G/V</p>
                  <p className={`text-base font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                    {isPositive ? '+' : ''}€{fmt(sectorGV)}
                    <span className="text-xs ml-1">({isPositive ? '+' : ''}{fmt(sectorGVPercent)}%)</span>
                  </p>
                </div>
              </>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Position hinzufügen
            </button>
          </div>
        </div>
      </div>

      {/* Position Cards Grid */}
      {(sector.positions || []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">Keine Positionen in diesem Sektor</p>
          <p className="text-sm mt-1">Klicke auf "Position hinzufügen" um zu starten.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {(sector.positions || []).map(position => (
            <PositionCard
              key={position.id}
              position={position}
              priceData={prices[position.ticker]}
              eurUsdRate={eurUsdRate}
              onRefresh={onRefresh}
              sectors={sectors}
              alerts={alerts}
            />
          ))}
        </div>
      )}

      {/* Add Position Modal */}
      {showAddModal && (
        <AddPositionModal
          sectors={sectors}
          defaultSectorId={sector.id}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
