import React, { useState } from 'react'
import axios from 'axios'
import { Thesis } from '../types'

interface ThesisPanelProps {
  ticker: string
  thesis: Thesis | null
  onUpdate: (thesis: Thesis) => void
}

const BUCKETS = ['A', 'B', 'C']

export default function ThesisPanel({ ticker, thesis, onUpdate }: ThesisPanelProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Omit<Thesis, 'id' | 'ticker' | 'updated_at'>>({
    bucket: thesis?.bucket || '',
    case: thesis?.case || '',
    right_if: thesis?.right_if || '',
    wrong_if: thesis?.wrong_if || '',
  })

  const isEmpty = !thesis || (!thesis.case && !thesis.right_if && !thesis.wrong_if)

  const startEdit = () => {
    setForm({
      bucket: thesis?.bucket || '',
      case: thesis?.case || '',
      right_if: thesis?.right_if || '',
      wrong_if: thesis?.wrong_if || '',
    })
    setEditing(true)
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await axios.put<Thesis>(`/api/thesis/${ticker}`, { ...form })
      onUpdate(data)
      setEditing(false)
    } catch (err) {
      console.error('Failed to save thesis:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">These</span>
          {isEmpty && (
            <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
              Nicht hinterlegt
            </span>
          )}
          {!isEmpty && thesis?.bucket && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
              Bucket {thesis.bucket}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {isEmpty && !editing && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-red-700">
                Keine These hinterlegt — kein regelkonformer Kauf möglich.
              </p>
            </div>
          )}

          {editing ? (
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bucket</label>
                <div className="flex gap-1.5">
                  {BUCKETS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, bucket: f.bucket === b ? '' : b }))}
                      className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                        form.bucket === b
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Investment Case</label>
                <textarea
                  rows={2}
                  value={form.case}
                  onChange={e => setForm(f => ({ ...f, case: e.target.value }))}
                  placeholder="Warum diese Position?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">These stimmt, wenn…</label>
                <textarea
                  rows={2}
                  value={form.right_if}
                  onChange={e => setForm(f => ({ ...f, right_if: e.target.value }))}
                  placeholder="Bedingungen für Erfolg"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">These falsch, wenn…</label>
                <textarea
                  rows={2}
                  value={form.wrong_if}
                  onChange={e => setForm(f => ({ ...f, wrong_if: e.target.value }))}
                  placeholder="Bedingungen für Ausstieg"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-60"
                >
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {thesis?.case && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Case</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{thesis.case}</p>
                </div>
              )}
              {thesis?.right_if && (
                <div>
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-0.5">These stimmt, wenn…</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{thesis.right_if}</p>
                </div>
              )}
              {thesis?.wrong_if && (
                <div>
                  <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-0.5">These falsch, wenn…</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{thesis.wrong_if}</p>
                </div>
              )}
              <button
                onClick={startEdit}
                className="text-xs text-accent hover:underline"
              >
                {isEmpty ? '+ These hinterlegen' : 'Bearbeiten'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
