import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { JournalEntry } from '../types'
import JournalEntryModal from './JournalEntryModal'

const LUCK_LABELS: Record<string, { label: string; cls: string }> = {
  skill:  { label: 'Skill',    cls: 'bg-green-100 text-green-700' },
  luck:   { label: 'Glück',    cls: 'bg-blue-100 text-blue-700' },
  loss:   { label: 'Verlust',  cls: 'bg-red-100 text-red-700' },
}

const ACTION_LABELS: Record<string, string> = {
  note: 'Notiz',
  buy: 'Kauf',
  sell: 'Verkauf',
  thesis_break: 'Thesenbruch',
  review: 'Review',
}

export default function JournalView() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTicker, setFilterTicker] = useState('')
  const [filterLuck, setFilterLuck] = useState('')
  const [showModal, setShowModal] = useState(false)

  const fetchEntries = useCallback(async () => {
    try {
      const { data } = await axios.get<JournalEntry[]>('/api/journal')
      setEntries(data)
    } catch (err) {
      console.error('Failed to fetch journal:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const filtered = entries.filter(e => {
    if (filterTicker && !(e.ticker || '').toUpperCase().includes(filterTicker.toUpperCase())) return false
    if (filterLuck && e.luck_or_skill !== filterLuck) return false
    return true
  })

  const total = entries.length
  const ruleFollowedCount = entries.filter(e => e.rule_followed).length
  const skillCount = entries.filter(e => e.luck_or_skill === 'skill').length
  const lossCount = entries.filter(e => e.luck_or_skill === 'loss').length
  const ratedCount = entries.filter(e => e.luck_or_skill).length
  const unplannedCount = entries.filter(e => e.unplanned).length

  return (
    <div>
      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Einträge</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Regel befolgt</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {total > 0 ? Math.round((ruleFollowedCount / total) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Skill-Quote</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {ratedCount > 0 ? Math.round((skillCount / ratedCount) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Außerplanmäßig</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">{unplannedCount}</p>
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Ticker filtern…"
          value={filterTicker}
          onChange={e => setFilterTicker(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-36"
        />
        <select
          value={filterLuck}
          onChange={e => setFilterLuck(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
        >
          <option value="">Alle Bewertungen</option>
          <option value="skill">Skill</option>
          <option value="luck">Glück</option>
          <option value="loss">Verlust</option>
        </select>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-1.5 bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Eintrag
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400">{entries.length === 0 ? 'Noch keine Einträge' : 'Keine Treffer'}</p>
          {entries.length === 0 && (
            <button onClick={() => setShowModal(true)} className="mt-3 text-accent hover:underline text-sm">
              Ersten Eintrag erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Datum</th>
                <th className="text-left px-4 py-3">Ticker</th>
                <th className="text-left px-4 py-3">Aktion</th>
                <th className="text-left px-4 py-3">Notiz</th>
                <th className="text-center px-4 py-3 hidden sm:table-cell">Bewertung</th>
                <th className="text-center px-4 py-3 hidden md:table-cell">Regel</th>
                <th className="text-center px-4 py-3 hidden md:table-cell">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(entry => (
                <tr key={entry.id} className={`hover:bg-gray-50 transition-colors ${entry.unplanned ? 'bg-orange-50/30' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString('de-DE') : '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {entry.ticker || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {ACTION_LABELS[entry.action] || entry.action}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">
                    <span className="line-clamp-2 text-xs">{entry.note}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {entry.luck_or_skill ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LUCK_LABELS[entry.luck_or_skill]?.cls || ''}`}>
                        {LUCK_LABELS[entry.luck_or_skill]?.label}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className={`text-xs ${entry.rule_followed ? 'text-green-600' : 'text-red-500'}`}>
                      {entry.rule_followed ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {entry.unplanned ? (
                      <span className="text-xs text-orange-500 font-medium">⚠ Unplanned</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <JournalEntryModal
          onClose={() => setShowModal(false)}
          onSave={entry => {
            setEntries(prev => [entry, ...prev])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}
