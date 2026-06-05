import React, { useState } from 'react'
import axios from 'axios'
import { JournalEntry } from '../types'

interface JournalEntryModalProps {
  defaultTicker?: string
  onClose: () => void
  onSave: (entry: JournalEntry) => void
}

export default function JournalEntryModal({ defaultTicker, onClose, onSave }: JournalEntryModalProps) {
  const [form, setForm] = useState({
    ticker: defaultTicker || '',
    action: 'note',
    note: '',
    luck_or_skill: '' as '' | 'luck' | 'skill' | 'loss',
    rule_followed: true,
    unplanned: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.note.trim()) { setError('Notiz ist erforderlich'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ticker: form.ticker || null,
        action: form.action,
        note: form.note,
        luck_or_skill: form.luck_or_skill || null,
        rule_followed: form.rule_followed,
        unplanned: form.unplanned,
      }
      const { data } = await axios.post<JournalEntry>('/api/journal', payload)
      onSave(data)
    } catch (err) {
      setError('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Journal-Eintrag</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ticker (optional)</label>
              <input
                type="text"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder="z.B. AAPL"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aktion</label>
              <select
                value={form.action}
                onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
              >
                <option value="note">Notiz</option>
                <option value="buy">Kauf</option>
                <option value="sell">Verkauf</option>
                <option value="thesis_break">Thesenbruch</option>
                <option value="review">Review</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notiz <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Was ist passiert? Was hast du gelernt?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Bewertung</label>
            <div className="flex gap-2">
              {(['luck', 'skill', 'loss'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, luck_or_skill: f.luck_or_skill === v ? '' : v }))}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    form.luck_or_skill === v
                      ? v === 'skill' ? 'bg-green-500 text-white border-green-500'
                        : v === 'luck' ? 'bg-blue-400 text-white border-blue-400'
                        : 'bg-red-400 text-white border-red-400'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {v === 'skill' ? 'Skill' : v === 'luck' ? 'Glück' : 'Verlust'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.rule_followed}
                onChange={e => setForm(f => ({ ...f, rule_followed: e.target.checked }))}
                className="rounded text-accent"
              />
              <span className="text-xs text-gray-700">Regel befolgt</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.unplanned}
                onChange={e => setForm(f => ({ ...f, unplanned: e.target.checked }))}
                className="rounded text-orange-500"
              />
              <span className="text-xs text-gray-700">Außerplanmäßig</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-dark rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? 'Speichern…' : 'Eintrag speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
