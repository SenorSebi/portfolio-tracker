import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Position, Trade, TradeFormData } from '../types'

interface TradeLogModalProps {
  position: Position
  onClose: () => void
  onSave: () => void
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export default function TradeLogModal({ position, onClose, onSave }: TradeLogModalProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loadingTrades, setLoadingTrades] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [form, setForm] = useState<TradeFormData>({
    position_id: position.id,
    trade_date: todayStr(),
    trade_type: 'Buy',
    shares: 0,
    price_eur: 0,
    broker_fee_eur: 0,
    notes: '',
  })

  const fetchTrades = useCallback(async () => {
    try {
      const res = await axios.get<Trade[]>(`/api/trades/${position.id}`)
      setTrades(res.data)
    } catch (err) {
      console.error('Failed to fetch trades:', err)
    } finally {
      setLoadingTrades(false)
    }
  }, [position.id])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.trade_date) newErrors.trade_date = 'Datum ist erforderlich'
    if (!form.shares || form.shares <= 0) newErrors.shares = 'Stück muss > 0 sein'
    if (!form.price_eur || form.price_eur <= 0) newErrors.price_eur = 'Kurs muss > 0 sein'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setSuccessMsg(null)
    try {
      await axios.post('/api/trades', {
        ...form,
        shares: Number(form.shares),
        price_eur: Number(form.price_eur),
        broker_fee_eur: Number(form.broker_fee_eur) || 0,
      })

      setForm(f => ({
        ...f,
        trade_date: todayStr(),
        trade_type: 'Buy',
        shares: 0,
        price_eur: 0,
        broker_fee_eur: 0,
        notes: '',
      }))
      setSuccessMsg('Trade erfolgreich gespeichert!')
      setTimeout(() => setSuccessMsg(null), 3000)
      fetchTrades()
      onSave()
    } catch (err: unknown) {
      console.error('Trade submission failed:', err)
      const message = err instanceof Error ? err.message : 'Fehler beim Speichern'
      setErrors({ submit: message })
    } finally {
      setSubmitting(false)
    }
  }

  const exportCsv = () => {
    if (trades.length === 0) return

    const headers = ['Datum', 'Typ', 'Stück', 'Kurs (€)', 'Gebühr (€)', 'Gesamt (€)', 'Notizen']
    const rows = trades.map(t => {
      const total = t.trade_type === 'Buy'
        ? t.shares * t.price_eur + t.broker_fee_eur
        : t.shares * t.price_eur - t.broker_fee_eur
      return [
        t.trade_date,
        t.trade_type,
        String(t.shares),
        fmt(t.price_eur),
        fmt(t.broker_fee_eur),
        fmt(total),
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trades_${position.ticker}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Calculate running average cost from trades (oldest first)
  const tradesAsc = [...trades].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  let runningShares = 0
  let runningCost = 0
  for (const t of tradesAsc) {
    if (t.trade_type === 'Buy') {
      runningCost += t.shares * t.price_eur + (t.broker_fee_eur || 0)
      runningShares += t.shares
    } else if (t.trade_type === 'Sell' && runningShares > 0) {
      const avgCost = runningCost / runningShares
      runningCost -= t.shares * avgCost
      runningShares -= t.shares
    }
  }
  if (runningShares < 0) runningShares = 0
  const runningAvgCost = runningShares > 0 ? runningCost / runningShares : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Trade Log</h2>
            <p className="text-sm text-gray-500 mt-0.5">{position.ticker} — {position.company_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* New Trade Form */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Neuer Trade</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                  {errors.submit}
                </div>
              )}
              {successMsg && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-success text-sm">
                  {successMsg}
                </div>
              )}

              {/* Date & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Datum <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.trade_date}
                    onChange={e => setForm(f => ({ ...f, trade_date: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white ${
                      errors.trade_date ? 'border-danger' : 'border-gray-300'
                    }`}
                  />
                  {errors.trade_date && <p className="text-xs text-danger mt-1">{errors.trade_date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, trade_type: 'Buy' }))}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        form.trade_type === 'Buy'
                          ? 'bg-success text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Kauf
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, trade_type: 'Sell' }))}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        form.trade_type === 'Sell'
                          ? 'bg-danger text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Verkauf
                    </button>
                  </div>
                </div>
              </div>

              {/* Shares & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Stück <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.shares || ''}
                    onChange={e => setForm(f => ({ ...f, shares: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white ${
                      errors.shares ? 'border-danger' : 'border-gray-300'
                    }`}
                  />
                  {errors.shares && <p className="text-xs text-danger mt-1">{errors.shares}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Kurs (€) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.price_eur || ''}
                    onChange={e => setForm(f => ({ ...f, price_eur: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white ${
                      errors.price_eur ? 'border-danger' : 'border-gray-300'
                    }`}
                  />
                  {errors.price_eur && <p className="text-xs text-danger mt-1">{errors.price_eur}</p>}
                </div>
              </div>

              {/* Fee & Total preview */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brokergebühr (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.broker_fee_eur || ''}
                    onChange={e => setForm(f => ({ ...f, broker_fee_eur: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gesamtbetrag</label>
                  <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-700 font-semibold">
                    €{fmt(
                      form.trade_type === 'Buy'
                        ? (form.shares || 0) * (form.price_eur || 0) + (form.broker_fee_eur || 0)
                        : (form.shares || 0) * (form.price_eur || 0) - (form.broker_fee_eur || 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notizen</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Trade speichern
              </button>
            </form>
          </div>

          {/* Trade History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Trade-Verlauf ({trades.length})
              </h3>
              {trades.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-accent bg-gray-100 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              )}
            </div>

            {loadingTrades ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Trades werden geladen...
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-sm">Noch keine Trades vorhanden</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Datum</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Typ</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Stück</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Kurs (€)</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Gebühr</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Gesamt</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 uppercase tracking-wide">Notizen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade, i) => {
                      const total =
                        trade.trade_type === 'Buy'
                          ? trade.shares * trade.price_eur + trade.broker_fee_eur
                          : trade.shares * trade.price_eur - trade.broker_fee_eur
                      return (
                        <tr
                          key={trade.id}
                          className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <td className="px-3 py-2.5 text-gray-700">{trade.trade_date}</td>
                          <td className="px-3 py-2.5">
                            <span className={`font-semibold ${trade.trade_type === 'Buy' ? 'text-success' : 'text-danger'}`}>
                              {trade.trade_type === 'Buy' ? 'Kauf' : 'Verkauf'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{trade.shares}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">€{fmt(trade.price_eur)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-500">€{fmt(trade.broker_fee_eur)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${trade.trade_type === 'Buy' ? 'text-gray-900' : 'text-success'}`}>
                            {trade.trade_type === 'Sell' ? '+' : ''}€{fmt(total)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate">{trade.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {trades.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200">
                        <td colSpan={2} className="px-3 py-2.5 font-semibold text-gray-700">
                          Laufender Durchschnitt
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{runningShares.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-accent">
                          €{fmt(runningAvgCost)}
                        </td>
                        <td colSpan={3} className="px-3 py-2.5 text-xs text-gray-500">
                          Gesamtwert: €{fmt(runningShares * runningAvgCost)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
