import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Sector, PositionFormData, DcaZone } from '../types'

interface AddPositionModalProps {
  sectors: Sector[]
  defaultSectorId?: number
  onClose: () => void
  onSave: () => void
  initialData?: PositionFormData
  editId?: number
}

const emptyForm = (sectorId: number): PositionFormData => ({
  ticker: '',
  company_name: '',
  sector_id: sectorId,
  position_type: 'Core',
  shares: 0,
  avg_cost_eur: 0,
  target_size_eur: 0,
  stop_loss_eur: null,
  notes: '',
  dca_zones: [],
})

export default function AddPositionModal({
  sectors,
  defaultSectorId,
  onClose,
  onSave,
  initialData,
  editId,
}: AddPositionModalProps) {
  const defaultSector = defaultSectorId ?? (sectors[0]?.id || 1)
  const [form, setForm] = useState<PositionFormData>(initialData || emptyForm(defaultSector))
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialData) {
      setForm(initialData)
    }
  }, [])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.ticker.trim()) newErrors.ticker = 'Ticker ist erforderlich'
    if (!form.company_name.trim()) newErrors.company_name = 'Unternehmensname ist erforderlich'
    if (!form.sector_id) newErrors.sector_id = 'Sektor ist erforderlich'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        ticker: form.ticker.toUpperCase().trim(),
        shares: Number(form.shares) || 0,
        avg_cost_eur: Number(form.avg_cost_eur) || 0,
        target_size_eur: Number(form.target_size_eur) || 0,
        stop_loss_eur: form.stop_loss_eur ? Number(form.stop_loss_eur) : null,
        dca_zones: form.dca_zones.map(z => ({
          price_eur: Number(z.price_eur),
          label: z.label,
        })),
      }

      if (editId) {
        await axios.put(`/api/positions/${editId}`, payload)
      } else {
        await axios.post('/api/positions', payload)
      }

      onSave()
    } catch (err: unknown) {
      console.error('Save position failed:', err)
      const message =
        err instanceof Error ? err.message : 'Fehler beim Speichern'
      setErrors({ submit: message })
    } finally {
      setSubmitting(false)
    }
  }

  const addDcaZone = () => {
    if (form.dca_zones.length >= 6) return
    setForm(f => ({
      ...f,
      dca_zones: [...f.dca_zones, { price_eur: 0, label: `Zone ${f.dca_zones.length + 1}` }],
    }))
  }

  const removeDcaZone = (index: number) => {
    setForm(f => ({
      ...f,
      dca_zones: f.dca_zones.filter((_, i) => i !== index),
    }))
  }

  const updateDcaZone = (index: number, field: keyof DcaZone, value: string | number) => {
    setForm(f => {
      const zones = [...f.dca_zones]
      zones[index] = { ...zones[index], [field]: value }
      return { ...f, dca_zones: zones }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">
            {editId ? 'Position bearbeiten' : 'Neue Position hinzufügen'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              {errors.submit}
            </div>
          )}

          {/* Ticker & Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ticker <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder="z.B. AAPL"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${
                  errors.ticker ? 'border-danger' : 'border-gray-300'
                }`}
              />
              {errors.ticker && <p className="text-xs text-danger mt-1">{errors.ticker}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Unternehmensname <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="z.B. Apple Inc."
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${
                  errors.company_name ? 'border-danger' : 'border-gray-300'
                }`}
              />
              {errors.company_name && <p className="text-xs text-danger mt-1">{errors.company_name}</p>}
            </div>
          </div>

          {/* Sector & Position Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sektor <span className="text-danger">*</span>
              </label>
              <select
                value={form.sector_id}
                onChange={e => setForm(f => ({ ...f, sector_id: Number(e.target.value) }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${
                  errors.sector_id ? 'border-danger' : 'border-gray-300'
                }`}
              >
                {sectors.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.sector_id && <p className="text-xs text-danger mt-1">{errors.sector_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Positionstyp</label>
              <select
                value={form.position_type}
                onChange={e => setForm(f => ({ ...f, position_type: e.target.value as PositionFormData['position_type'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="Core">Core</option>
                <option value="Speculative">Speculative</option>
                <option value="Watchlist">Watchlist</option>
              </select>
            </div>
          </div>

          {/* Shares & Avg Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Anzahl Stück</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.shares || ''}
                onChange={e => setForm(f => ({ ...f, shares: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Durchschnittlicher Einstand (€)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.avg_cost_eur || ''}
                onChange={e => setForm(f => ({ ...f, avg_cost_eur: parseFloat(e.target.value) || 0 }))}
                placeholder="0,00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
          </div>

          {/* Target Size & Stop Loss */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zielgröße (€)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.target_size_eur || ''}
                onChange={e => setForm(f => ({ ...f, target_size_eur: parseFloat(e.target.value) || 0 }))}
                placeholder="5000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Stop-Loss (€, optional)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.stop_loss_eur ?? ''}
                onChange={e => setForm(f => ({ ...f, stop_loss_eur: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
          </div>

          {/* DCA Zones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                DCA Zonen <span className="text-gray-400">({form.dca_zones.length}/6)</span>
              </label>
              {form.dca_zones.length < 6 && (
                <button
                  type="button"
                  onClick={addDcaZone}
                  className="text-xs font-medium text-accent hover:text-accent-dark flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Zone hinzufügen
                </button>
              )}
            </div>
            {form.dca_zones.length === 0 && (
              <p className="text-xs text-gray-400 py-2 text-center border-2 border-dashed border-gray-200 rounded-lg">
                Keine DCA Zonen. Klicke "+ Zone hinzufügen".
              </p>
            )}
            <div className="space-y-2">
              {form.dca_zones.map((zone, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <input
                    type="text"
                    value={zone.label}
                    onChange={e => updateDcaZone(i, 'label', e.target.value)}
                    placeholder="Zone 1"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500">€</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={zone.price_eur || ''}
                      onChange={e => updateDcaZone(i, 'price_eur', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDcaZone(i)}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-danger rounded hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notizen</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Strategie, Gründe, Erinnerungen..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {editId ? 'Speichern' : 'Position hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
