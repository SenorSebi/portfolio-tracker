import React from 'react'
import { Sector, PriceData } from '../types'

interface SummaryBarProps {
  sectors: Sector[]
  prices: Record<string, PriceData>
  eurUsdRate: number
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SummaryBar({ sectors, prices, eurUsdRate }: SummaryBarProps) {
  let totalInvested = 0
  let currentValue = 0

  for (const sector of sectors) {
    for (const position of sector.positions || []) {
      const invested = position.shares * position.avg_cost_eur
      totalInvested += invested

      const priceData = prices[position.ticker]
      if (priceData && priceData.priceUsd > 0 && position.shares > 0) {
        currentValue += position.shares * (priceData.priceUsd / eurUsdRate)
      } else {
        // If no price or 0 shares, count at cost
        currentValue += invested
      }
    }
  }

  const totalGV = currentValue - totalInvested
  const totalGVPercent = totalInvested > 0 ? (totalGV / totalInvested) * 100 : 0
  const isPositive = totalGV >= 0

  // Count positions with actual holdings
  const activePositions = sectors.reduce((acc, s) => {
    return acc + (s.positions || []).filter(p => p.shares > 0).length
  }, 0)

  const totalPositions = sectors.reduce((acc, s) => acc + (s.positions || []).length, 0)

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Invested */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Investiert</p>
            <p className="text-xl font-bold text-gray-900">€{fmt(totalInvested)}</p>
            <p className="text-xs text-gray-400 mt-1">{activePositions} aktive Positionen</p>
          </div>

          {/* Current Value */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Aktueller Wert</p>
            <p className="text-xl font-bold text-gray-900">€{fmt(currentValue)}</p>
            <p className="text-xs text-gray-400 mt-1">{totalPositions} Positionen gesamt</p>
          </div>

          {/* G/V */}
          <div className={`rounded-xl p-4 ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              Gewinn / Verlust
            </p>
            <p className={`text-xl font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
              {isPositive ? '+' : ''}€{fmt(totalGV)}
            </p>
            <p className={`text-xs font-medium mt-1 ${isPositive ? 'text-success' : 'text-danger'}`}>
              {isPositive ? '+' : ''}{fmt(totalGVPercent)}%
            </p>
          </div>

          {/* Sectors */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sektoren</p>
            <p className="text-xl font-bold text-gray-900">{sectors.length}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {sectors.map(s => (
                <span key={s.id} className="text-xs text-gray-500 bg-gray-200 rounded px-1.5 py-0.5">
                  {s.name.split('/')[0].trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
