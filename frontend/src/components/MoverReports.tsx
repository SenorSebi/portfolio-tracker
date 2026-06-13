import React, { useState } from 'react'
import { MoverReport } from '../types'

function fmt2(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `vor ${Math.max(1, mins)} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
}

function MoverCard({ mover }: { mover: MoverReport }) {
  const [open, setOpen] = useState(true)
  const up = mover.changePercent >= 0
  const accent = up ? 'green' : 'red'

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${up ? 'border-green-200' : 'border-red-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${up ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{up ? '🚀' : '⚠️'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{mover.ticker}</span>
              <span className="text-xs text-gray-500 truncate hidden sm:inline">{mover.company_name}</span>
            </div>
            <span className="text-xs text-gray-500">€{fmt2(mover.priceEur)} · ${fmt2(mover.priceUsd)}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-xl font-bold ${up ? 'text-success' : 'text-danger'}`}>
            {up ? '+' : ''}{mover.changePercent.toFixed(1)}%
          </div>
          <span className="text-xs text-gray-400">heute</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Mögliche Auslöser ({mover.news.length})
          </span>
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          mover.news.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Keine aktuellen Schlagzeilen gefunden — Bewegung evtl. sektor-/marktgetrieben. Prüfe den Markt- und Sektor-Feed.
            </p>
          ) : (
            <ul className="space-y-2">
              {mover.news.map((n, i) => (
                <li key={i}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="block group">
                    <p className="text-sm text-gray-800 leading-snug group-hover:text-accent">{n.headline}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className="font-medium text-gray-500">{n.source}</span>
                      <span>·</span>
                      <span>{relativeTime(n.datetime)}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}

export default function MoverReports({ movers }: { movers: MoverReport[] }) {
  if (!movers || movers.length === 0) return null
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
        ⚡ Auffällige Tagesbewegungen
        <span className="text-xs font-normal text-gray-400 normal-case">(±15% an einem Tag)</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {movers.map(m => <MoverCard key={m.ticker} mover={m} />)}
      </div>
    </div>
  )
}
