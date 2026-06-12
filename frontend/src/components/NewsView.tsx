import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { NewsItem } from '../types'

type Tab = 'positions' | 'market' | 'sectors'

interface NewsResponse {
  finnhubConfigured: boolean
  news: NewsItem[] | Record<string, NewsItem[]>
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 0) return 'gerade eben'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
  return new Date(ms).toLocaleDateString('de-DE')
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white border border-gray-200 rounded-xl p-3.5 hover:border-accent hover:shadow-sm transition-all group"
    >
      <div className="flex gap-3">
        {item.image && (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-gray-100"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-accent line-clamp-2">
            {item.headline}
          </p>
          {item.summary && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{item.summary}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            {item.ticker && (
              <span className="font-bold text-accent bg-blue-50 rounded px-1.5 py-0.5">{item.ticker}</span>
            )}
            <span className="font-medium text-gray-500">{item.source}</span>
            <span>·</span>
            <span>{relativeTime(item.datetime)}</span>
          </div>
        </div>
      </div>
    </a>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function NewsView() {
  const [tab, setTab] = useState<Tab>('positions')
  const [posSort, setPosSort] = useState<'date' | 'ticker'>('date')
  const [loading, setLoading] = useState(false)
  const [finnhubConfigured, setFinnhubConfigured] = useState(true)

  // Cache results per tab so switching back is instant.
  const [positionNews, setPositionNews] = useState<Record<string, NewsItem[]> | null>(null)
  const [marketNews, setMarketNews] = useState<NewsItem[] | null>(null)
  const [sectorNews, setSectorNews] = useState<Record<string, NewsItem[]> | null>(null)

  const load = useCallback(async (which: Tab, force = false) => {
    if (which === 'positions' && positionNews && !force) return
    if (which === 'market' && marketNews && !force) return
    if (which === 'sectors' && sectorNews && !force) return

    setLoading(true)
    try {
      const { data } = await axios.get<NewsResponse>(`/api/news/${which}`)
      setFinnhubConfigured(data.finnhubConfigured)
      if (which === 'positions') setPositionNews(data.news as Record<string, NewsItem[]>)
      else if (which === 'market') setMarketNews(data.news as NewsItem[])
      else setSectorNews(data.news as Record<string, NewsItem[]>)
    } catch (err) {
      console.error(`Failed to load ${which} news:`, err)
    } finally {
      setLoading(false)
    }
  }, [positionNews, marketNews, sectorNews])

  useEffect(() => {
    load(tab)
  }, [tab, load])

  const SUBTABS: { id: Tab; label: string }[] = [
    { id: 'positions', label: 'Meine Positionen' },
    { id: 'market', label: 'Markt' },
    { id: 'sectors', label: 'Sektoren' },
  ]

  const renderGrouped = (groups: Record<string, NewsItem[]> | null) => {
    if (!groups) return null
    const keys = Object.keys(groups).filter(k => groups[k] && groups[k].length > 0)
    if (keys.length === 0) {
      return <p className="text-center text-gray-400 py-16 text-sm">Keine aktuellen Nachrichten gefunden.</p>
    }
    return (
      <div className="space-y-6">
        {keys.map(key => (
          <div key={key}>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2.5 flex items-center gap-2">
              {key}
              <span className="text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {groups[key].length}
              </span>
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {groups[key].map((item, i) => <NewsCard key={i} item={item} />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Merge all per-ticker news into one chronological stream (newest first).
  const flattenPositions = (groups: Record<string, NewsItem[]> | null): NewsItem[] => {
    if (!groups) return []
    const all: NewsItem[] = []
    for (const key of Object.keys(groups)) {
      for (const item of groups[key]) all.push({ ...item, ticker: item.ticker || key })
    }
    return all.sort((a, b) => b.datetime - a.datetime).slice(0, 50)
  }

  const renderFlat = (items: NewsItem[] | null) => {
    if (!items) return null
    if (items.length === 0) {
      return <p className="text-center text-gray-400 py-16 text-sm">Keine aktuellen Nachrichten gefunden.</p>
    }
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {items.map((item, i) => <NewsCard key={i} item={item} />)}
      </div>
    )
  }

  return (
    <div>
      {/* Sub-tabs + refresh */}
      <div className="flex items-center justify-between mb-5">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          {SUBTABS.map(st => (
            <button
              key={st.id}
              onClick={() => setTab(st.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === st.id ? 'bg-white text-accent shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(tab, true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
      </div>

      {/* Positionen: Sortierung */}
      {tab === 'positions' && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400">Sortierung:</span>
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPosSort('date')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                posSort === 'date' ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Nach Datum
            </button>
            <button
              onClick={() => setPosSort('ticker')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                posSort === 'ticker' ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Nach Ticker
            </button>
          </div>
        </div>
      )}

      {/* Finnhub hint */}
      {tab === 'positions' && !finnhubConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-blue-700">
          Tipp: Setze die Umgebungsvariable <code className="font-mono bg-blue-100 px-1 rounded">FINNHUB_API_KEY</code> für
          strukturierte Unternehmensnachrichten. Aktuell werden Yahoo-Finance-Feeds als Fallback genutzt.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Spinner />
      ) : tab === 'positions' ? (
        posSort === 'date' ? renderFlat(flattenPositions(positionNews)) : renderGrouped(positionNews)
      ) : tab === 'market' ? (
        renderFlat(marketNews)
      ) : (
        renderGrouped(sectorNews)
      )}
    </div>
  )
}
