import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { PortfolioData, Sector } from './types'
import SummaryBar from './components/SummaryBar'
import SectorView from './components/SectorView'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

export default function App() {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await axios.get('/api/prices/refresh')
      await fetchPortfolio()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setRefreshing(false)
    }
  }, [fetchPortfolio])

  useEffect(() => {
    fetchPortfolio()
    const interval = setInterval(fetchPortfolio, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPortfolio])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Loading portfolio...</p>
        </div>
      </div>
    )
  }

  if (error && !portfolioData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to load portfolio</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPortfolio}
            className="bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent-dark transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const sectors: Sector[] = portfolioData?.sectors || []
  const prices = portfolioData?.prices || {}
  const eurUsdRate = portfolioData?.eurUsdRate || 1.08

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
            {lastUpdated && (
              <span className="text-xs text-gray-400 hidden sm:block">
                Updated: {lastUpdated.toLocaleTimeString('de-DE')}
              </span>
            )}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-500 font-medium">EUR/USD</span>
              <span className="text-sm font-semibold text-gray-800">
                {eurUsdRate.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-60"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Sector Tabs */}
        {sectors.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0">
            {sectors.map((sector, index) => (
              <button
                key={sector.id}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === index
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {sector.name}
                <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                  activeTab === index ? 'bg-blue-100 text-accent' : 'bg-gray-100 text-gray-500'
                }`}>
                  {sector.positions?.length || 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Summary Bar */}
      {portfolioData && (
        <SummaryBar
          sectors={sectors}
          prices={prices}
          eurUsdRate={eurUsdRate}
        />
      )}

      {/* Error Banner (non-fatal) */}
      {error && portfolioData && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            Warning: {error}
          </div>
        </div>
      )}

      {/* Active Sector View */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {sectors.length > 0 && sectors[activeTab] && (
          <SectorView
            key={sectors[activeTab].id}
            sector={sectors[activeTab]}
            allSectors={sectors}
            prices={prices}
            eurUsdRate={eurUsdRate}
            onRefresh={fetchPortfolio}
          />
        )}
        {sectors.length === 0 && !loading && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No sectors found. Check your database connection.</p>
          </div>
        )}
      </main>
    </div>
  )
}
