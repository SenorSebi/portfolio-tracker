import React, { useState } from 'react'
import { Alert } from '../types'

interface AlertBannerProps {
  alerts: Alert[]
}

export default function AlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = alerts.filter(a => !dismissed.has(`${a.ticker}-${a.type}-${a.triggerPriceEur}`))
  if (visible.length === 0) return null

  const stopAlerts = visible.filter(a => a.type === 'stop_loss')
  const tpAlerts = visible.filter(a => a.type === 'take_profit')

  const dismiss = (a: Alert) => {
    setDismissed(s => new Set([...s, `${a.ticker}-${a.type}-${a.triggerPriceEur}`]))
  }

  const dismissAll = () => {
    setDismissed(new Set(visible.map(a => `${a.ticker}-${a.type}-${a.triggerPriceEur}`)))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 mt-3 space-y-2">
      {stopAlerts.map(a => (
        <div key={`${a.ticker}-${a.type}`} className="flex items-start justify-between gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-lg leading-none mt-0.5">🔴</span>
            <div>
              <p className="text-sm font-bold text-red-800">STOP-LOSS: {a.ticker}</p>
              <p className="text-xs text-red-700 mt-0.5">{a.message}</p>
              <p className="text-xs text-red-500 mt-0.5">Aktuell €{a.priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Auslöse €{a.triggerPriceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <button onClick={() => dismiss(a)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-lg leading-none">×</button>
        </div>
      ))}
      {tpAlerts.map(a => (
        <div key={`${a.ticker}-${a.type}-${a.triggerPriceEur}`} className="flex items-start justify-between gap-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg leading-none mt-0.5">🎯</span>
            <div>
              <p className="text-sm font-bold text-yellow-800">TAKE-PROFIT: {a.ticker}</p>
              <p className="text-xs text-yellow-700 mt-0.5">{a.message}</p>
              <p className="text-xs text-yellow-500 mt-0.5">Aktuell €{a.priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Ziel €{a.triggerPriceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <button onClick={() => dismiss(a)} className="text-yellow-400 hover:text-yellow-600 flex-shrink-0 text-lg leading-none">×</button>
        </div>
      ))}
      {visible.length > 1 && (
        <div className="flex justify-end">
          <button onClick={dismissAll} className="text-xs text-gray-400 hover:text-gray-600">Alle schließen</button>
        </div>
      )}
    </div>
  )
}
