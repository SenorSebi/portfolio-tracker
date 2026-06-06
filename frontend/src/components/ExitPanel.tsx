import React, { useState } from 'react'
import axios from 'axios'
import { ExitRules, TakeProfitRule } from '../types'

interface ExitPanelProps {
  ticker: string
  exitRules: ExitRules | null
  avgCostEur: number
  priceEur: number | null
  onUpdate: (rules: ExitRules) => void
}

function fmt2(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ExitPanel({ ticker, exitRules, avgCostEur, priceEur, onUpdate }: ExitPanelProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stopPct, setStopPct] = useState<string>(exitRules?.stop_loss_pct?.toString() || '')
  const [thesisBreak, setThesisBreak] = useState(exitRules?.thesis_break_condition || '')
  const [rules, setRules] = useState<TakeProfitRule[]>(exitRules?.take_profit_rules || [])
  const [trailingStopPct, setTrailingStopPct] = useState<string>(exitRules?.trailing_stop_pct?.toString() || '')

  const hasRules = exitRules && (exitRules.stop_loss_pct !== null || exitRules.take_profit_rules.length > 0)

  const stopPrice = exitRules?.stop_loss_pct && avgCostEur > 0
    ? avgCostEur * (1 - exitRules.stop_loss_pct / 100)
    : null
  const stopTriggered = stopPrice !== null && priceEur !== null && priceEur <= stopPrice

  const startEdit = () => {
    setStopPct(exitRules?.stop_loss_pct?.toString() || '')
    setThesisBreak(exitRules?.thesis_break_condition || '')
    setRules(exitRules?.take_profit_rules ? [...exitRules.take_profit_rules] : [])
    setTrailingStopPct(exitRules?.trailing_stop_pct?.toString() || '')
    setEditing(true)
    setOpen(true)
  }

  const addRule = () => setRules(r => [...r, { targetPct: 0, sharesToSell: 25, label: '' }])
  const removeRule = (i: number) => setRules(r => r.filter((_, idx) => idx !== i))
  const updateRule = (i: number, field: keyof TakeProfitRule, value: string | number) => {
    setRules(r => r.map((rule, idx) => idx === i ? { ...rule, [field]: value } : rule))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        stop_loss_pct: stopPct ? parseFloat(stopPct) : null,
        take_profit_rules: rules,
        thesis_break_condition: thesisBreak,
        trailing_stop_pct: trailingStopPct ? parseFloat(trailingStopPct) : null,
      }
      const { data } = await axios.put<ExitRules>(`/api/exit-rules/${ticker}`, payload)
      onUpdate(data)
      setEditing(false)
    } catch (err) {
      console.error('Failed to save exit rules:', err)
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
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exit-Regeln</span>
          {stopTriggered && (
            <span className="text-xs font-bold text-red-700 bg-red-100 border border-red-300 rounded px-1.5 py-0.5 animate-pulse">
              STOP-LOSS AKTIV
            </span>
          )}
          {!hasRules && (
            <span className="text-xs text-gray-400">Keine hinterlegt</span>
          )}
          {exitRules?.stop_loss_pct && !stopTriggered && (
            <span className="text-xs text-gray-500">SL {exitRules.stop_loss_pct}%</span>
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
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stop-Loss (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={stopPct}
                  onChange={e => setStopPct(e.target.value)}
                  placeholder="z.B. 15"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
                {stopPct && avgCostEur > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Auslösekurs: €{fmt2(avgCostEur * (1 - parseFloat(stopPct) / 100))}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">Take-Profit Stufen</label>
                  <button onClick={addRule} className="text-xs text-accent hover:underline">+ Stufe</button>
                </div>
                {rules.map((rule, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5 items-center">
                    <input
                      type="number"
                      placeholder="+%"
                      value={rule.targetPct || ''}
                      onChange={e => updateRule(i, 'targetPct', parseFloat(e.target.value) || 0)}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                    <input
                      type="number"
                      placeholder="% sell"
                      value={rule.sharesToSell || ''}
                      onChange={e => updateRule(i, 'sharesToSell', parseFloat(e.target.value) || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                    <input
                      placeholder="Label"
                      value={rule.label}
                      onChange={e => updateRule(i, 'label', e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                    <button onClick={() => removeRule(i)} className="text-danger hover:opacity-70 text-xs px-1">✕</button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trailing-Stop (%)</label>
                <input
                  type="number" min="0" step="0.1"
                  value={trailingStopPct}
                  onChange={e => setTrailingStopPct(e.target.value)}
                  placeholder="z.B. 20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Thesenbruch-Bedingung</label>
                <textarea
                  rows={2}
                  value={thesisBreak}
                  onChange={e => setThesisBreak(e.target.value)}
                  placeholder="Wann ist die These gebrochen?"
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
              {exitRules?.stop_loss_pct && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  stopTriggered ? 'bg-red-100 border border-red-300' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <span className={`text-xs font-semibold ${stopTriggered ? 'text-red-700' : 'text-gray-700'}`}>
                    Stop-Loss {exitRules.stop_loss_pct}%
                  </span>
                  {stopPrice !== null && (
                    <span className={`text-xs font-bold ${stopTriggered ? 'text-red-700' : 'text-gray-600'}`}>
                      €{fmt2(stopPrice)}
                      {stopTriggered && ' ⚠ AKTIV'}
                    </span>
                  )}
                </div>
              )}

              {exitRules?.take_profit_rules && exitRules.take_profit_rules.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Take-Profit</p>
                  {exitRules.take_profit_rules.map((rule, i) => {
                    const targetPrice = avgCostEur > 0 ? avgCostEur * (1 + rule.targetPct / 100) : null
                    const triggered = targetPrice !== null && priceEur !== null && priceEur >= targetPrice
                    return (
                      <div key={i} className={`flex items-center justify-between rounded px-2 py-1.5 ${
                        triggered ? 'bg-yellow-50 border border-yellow-300' : 'bg-gray-50'
                      }`}>
                        <span className={`text-xs ${triggered ? 'text-yellow-700 font-semibold' : 'text-gray-600'}`}>
                          +{rule.targetPct}% → {rule.sharesToSell}% verkaufen
                          {rule.label && <span className="ml-1 text-gray-400">({rule.label})</span>}
                        </span>
                        {targetPrice !== null && (
                          <span className={`text-xs font-bold ${triggered ? 'text-yellow-700' : 'text-gray-500'}`}>
                            €{fmt2(targetPrice)}
                            {triggered && ' ✓'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {exitRules?.trailing_stop_pct && (
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 border border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">Trailing-Stop</span>
                  <span className="text-xs font-bold text-gray-600">{exitRules.trailing_stop_pct}%</span>
                </div>
              )}

              {exitRules?.thesis_break_condition && (
                <div>
                  <p className="text-xs text-orange-600 font-medium uppercase tracking-wide mb-0.5">Thesenbruch</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{exitRules.thesis_break_condition}</p>
                </div>
              )}

              {!hasRules && (
                <p className="text-xs text-gray-400">Keine Exit-Regeln hinterlegt.</p>
              )}

              <button onClick={startEdit} className="text-xs text-accent hover:underline">
                {hasRules ? 'Bearbeiten' : '+ Exit-Regeln hinterlegen'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
