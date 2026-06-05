import React, { useState } from 'react'

interface PanicGuardModalProps {
  ticker: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export default function PanicGuardModal({ ticker, onConfirm, onCancel }: PanicGuardModalProps) {
  const [reason, setReason] = useState('')

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⏸</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">48h-Regel — {ticker}</h2>
              <p className="text-sm text-gray-500">Kein aktiver Alert — ungeplanter Verkauf</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Dieser Verkauf wurde nicht durch einen Stop-Loss oder Take-Profit Alert ausgelöst.
            Bitte begründe, warum du trotzdem verkaufen möchtest.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Begründung <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Warum möchtest du jetzt verkaufen?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none"
              autoFocus
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-orange-700 font-medium">
              Dieser Eintrag wird automatisch im Journal als außerplanmäßig markiert.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-50"
          >
            Trotzdem verkaufen
          </button>
        </div>
      </div>
    </div>
  )
}
