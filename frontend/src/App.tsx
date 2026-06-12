import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import axios from 'axios'
import { PortfolioData, Sector, Alert } from './types'
import SummaryBar from './components/SummaryBar'
import SectorView from './components/SectorView'
import OverviewList from './components/OverviewList'
import AlertBanner from './components/AlertBanner'
import JournalView from './components/JournalView'
import NewsView from './components/NewsView'

type ActiveView = 'overview' | 'journal' | 'news' | number

interface RefreshStatus {
  total: number
  updated: number
  pending: number
  nextBatchAt: number | null
  done: boolean
}

function computeAlerts(sectors: Sector[], prices: Record<string, { priceUsd: number }>, eurUsdRate: number): Alert[] {
  const alerts: Alert[] = []
  for (const sector of sectors) {
    for (const position of sector.positions || []) {
      if (!position.exit_rules || position.shares === 0) continue
      const pd = prices[position.ticker]
      if (!pd || pd.priceUsd === 0) continue
      const priceEur = pd.priceUsd / eurUsdRate

      if (position.exit_rules.stop_loss_pct && position.avg_cost_eur > 0) {
        const stopPrice = position.avg_cost_eur * (1 - position.exit_rules.stop_loss_pct / 100)
        if (priceEur <= stopPrice) {
          alerts.push({
            ticker: position.ticker,
            companyName: position.company_name,
            type: 'stop_loss',
            message: `${position.ticker} unter Stop-Loss (${position.exit_rules.stop_loss_pct}% unter Einstand)`,
            priceEur,
            triggerPriceEur: stopPrice,
          })
        }
      }

      for (const rule of position.exit_rules.take_profit_rules) {
        if (position.avg_cost_eur > 0) {
          const targetPrice = position.avg_cost_eur * (1 + rule.targetPct / 100)
          if (priceEur >= targetPrice) {
            alerts.push({
              ticker: position.ticker,
              companyName: position.company_name,
              type: 'take_profit',
              message: `${position.ticker} Take-Profit +${rule.targetPct}%${rule.label ? ' – ' + rule.label : ''} erreicht`,
              priceEur,
              triggerPriceEur: targetPrice,
            })
          }
        }
      }
    }
  }
  return alerts
}

export default function App() {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevUpdatedRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const fetchPortfolio = useCallback(async () => {
    try {
      setError(null)
      const res = await axios.get<PortfolioData>('/api/portfolio')
      setPortfolioData(res.data)
      setLastUpdated(new Date())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load portfolio'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await axios.get<RefreshStatus>('/api/prices/status')
      setRefreshStatus(data)

      if (data.nextBatchAt) {
        setCountdown(Math.max(0, Math.round((data.nextBatchAt - Date.now()) / 1000)))
      }

      if (data.updated > prevUpdatedRef.current) {
        prevUpdatedRef.current = data.updated
        fetchPortfolio()
      }

      if (data.done) {
        stopPolling()
        fetchPortfolio()
        setTimeout(() => setRefreshStatus(null), 4000)
      }
    } catch (err) {
      console.error('Status check failed:', err)
    }
  }, [fetchPortfolio, stopPolling])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    stopPolling()
    prevUpdatedRef.current = 0
    setCountdown(null)

    try {
      await axios.get('/api/prices/refresh')
      await checkStatus()
      await fetchPortfolio()

      pollRef.current = setInterval(checkStatus, 5000)

      countdownRef.current = setInterval(() => {
        setCountdown(prev => (prev !== null && prev > 0) ? prev - 1 : prev)
      }, 1000)
    } catch (err) {
      console.error('Refresh failed:', err)
      stopPolling()
    } finally {
      setRefreshing(false)
    }
  }, [checkStatus, fetchPortfolio, stopPolling])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  const sectors: Sector[] = portfolioData?.sectors || []
  const prices = portfolioData?.prices || {}
  const eurUsdRate = portfolioData?.eurUsdRate || 1.08

  const alerts = useMemo(
    () => computeAlerts(sectors, prices, eurUsdRate),
    [sectors, prices, eurUsdRate]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Lade Portfolio...</p>
        </div>
      </div>
    )
  }

  if (error && !portfolioData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Fehler beim Laden</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={fetchPortfolio} className="bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent-dark transition-colors">
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  const isRefreshing = refreshing || (refreshStatus !== null && !refreshStatus.done)
  const stopAlertCount = alerts.filter(a => a.type === 'stop_loss').length
  const tpAlertCount = alerts.filter(a => a.type === 'take_profit').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Portfolio Tracker</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Alert chips */}
            {stopAlertCount > 0 && (
              <span className="text-xs font-bold text-red-700 bg-red-100 border border-red-300 rounded-full px-2.5 py-1 animate-pulse">
                🔴 {stopAlertCount} Stop
              </span>
            )}
            {tpAlertCount > 0 && (
              <span className="text-xs font-bold text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-full px-2.5 py-1">
                🎯 {tpAlertCount} TP
              </span>
            )}

            {/* Progress / Status display */}
            {refreshStatus ? (
              <div className="flex items-center gap-2 text-sm">
                {refreshStatus.done ? (
                  <span className="text-green-600 font-semibold">
                    ✓ Alle {refreshStatus.total} aktualisiert
                  </span>
                ) : (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span className="font-semibold text-gray-800">
                      {refreshStatus.updated}/{refreshStatus.total}
                    </span>
                    <span className="text-gray-400 text-xs hidden sm:block">aktualisiert</span>
                    {countdown !== null && countdown > 0 && (
                      <span className="text-gray-400 text-xs hidden sm:block">
                        · nächste in {countdown}s
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : lastUpdated ? (
              <span className="text-xs text-gray-400 hidden sm:block">
                Stand: {lastUpdated.toLocaleTimeString('de-DE')}
              </span>
            ) : null}

            {/* EUR/USD */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-500 font-medium">EUR/USD</span>
              <span className="text-sm font-semibold text-gray-800">
                {eurUsdRate.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </span>
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-60"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? 'Lädt...' : 'Aktualisieren'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0">
          <button
            onClick={() => setActiveView('overview')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeView === 'overview'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Übersicht
          </button>
          {sectors.map((sector, index) => (
            <button
              key={sector.id}
              onClick={() => setActiveView(index)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeView === index
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {sector.name}
              <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                activeView === index ? 'bg-blue-100 text-accent' : 'bg-gray-100 text-gray-500'
              }`}>
                {sector.positions?.length || 0}
              </span>
            </button>
          ))}
          <button
            onClick={() => setActiveView('journal')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeView === 'journal'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Journal
          </button>
          <button
            onClick={() => setActiveView('news')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeView === 'news'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            News
          </button>
        </div>
      </header>

      {/* Alert Banner */}
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* Summary Bar */}
      {portfolioData && activeView !== 'journal' && activeView !== 'news' && (
        <SummaryBar sectors={sectors} prices={prices} eurUsdRate={eurUsdRate} />
      )}

      {/* Error Banner */}
      {error && portfolioData && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeView === 'journal' ? (
          <JournalView />
        ) : activeView === 'news' ? (
          <NewsView />
        ) : activeView === 'overview' ? (
          <OverviewList sectors={sectors} prices={prices} eurUsdRate={eurUsdRate} />
        ) : (
          typeof activeView === 'number' && sectors[activeView] && (
            <SectorView
              key={sectors[activeView].id}
              sector={sectors[activeView]}
              allSectors={sectors}
              prices={prices}
              eurUsdRate={eurUsdRate}
              onRefresh={fetchPortfolio}
              alerts={alerts}
            />
          )
        )}
        {activeView !== 'journal' && activeView !== 'news' && sectors.length === 0 && !loading && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">Keine Sektoren gefunden.</p>
          </div>
        )}
      </main>
    </div>
  )
}
