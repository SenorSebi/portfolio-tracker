import React from 'react'
import { UpcomingEvent } from '../types'

const ICONS: Record<string, string> = {
  earnings: '📊',
  split: '✂️',
  dividend: '💰',
}

function whenText(days: number): string {
  if (days <= 0) return 'heute'
  if (days === 1) return 'morgen'
  if (days <= 14) return `in ${days} T.`
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

// Urgency colouring: imminent events stand out.
function urgencyCls(days: number): string {
  if (days <= 3) return 'bg-red-50 text-red-700 border-red-200'
  if (days <= 10) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

export function EventBadge({ event, compact = false }: { event: UpcomingEvent; compact?: boolean }) {
  const title = [event.label, event.detail, new Date(event.date).toLocaleDateString('de-DE')]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-xs font-medium rounded border px-1.5 py-0.5 whitespace-nowrap ${urgencyCls(event.daysUntil)}`}
    >
      <span>{ICONS[event.type] || '📅'}</span>
      {!compact && <span>{event.label}</span>}
      <span className="font-semibold">{whenText(event.daysUntil)}</span>
    </span>
  )
}

export default EventBadge
