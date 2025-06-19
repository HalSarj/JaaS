'use client'

import { useState, useEffect } from 'react'
import { Calendar, RefreshCw, Lightbulb, Target, MessageCircle, TrendingUp, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api'

interface DashboardInsights {
  pattern_insight: string
  today_practice: {
    type: 'immediate' | 'deeper'
    action: string
    duration_minutes: number
  }
  integration_bridge: string
  reflection_prompt: string
  context_thread: string
  generated_at: string
  dreams_analyzed: number
}

interface MorningDashboardProps {
  className?: string
}

export function MorningDashboard({ className }: MorningDashboardProps) {
  const [insights, setInsights] = useState<DashboardInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const data = await apiClient.getDashboardInsights(isRefresh)
      setInsights(data)
      
      // Cache insights in localStorage with timestamp
      if (data) {
        localStorage.setItem('dashboard_insights', JSON.stringify({
          data,
          cached_at: new Date().toISOString(),
          generated_at: data.generated_at
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadInsights = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check for cached insights first
      const cached = localStorage.getItem('dashboard_insights')
      if (cached) {
        const { data: cachedData, cached_at } = JSON.parse(cached)
        const cacheDate = new Date(cached_at)
        const today = new Date()
        
        // If cached insights are from today, use them initially
        if (cacheDate.toDateString() === today.toDateString()) {
          setInsights(cachedData)
          setLoading(false)
          
          // Check if there are newer dreams that would require refresh
          await checkForNewerDreams(cachedData.generated_at)
          return
        }
      }
      
      // No valid cache, fetch fresh insights
      await fetchInsights(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
      setLoading(false)
    }
  }

  const checkForNewerDreams = async (lastGeneratedAt: string) => {
    try {
      const dreams = await apiClient.getDreams()
      const newerDreams = dreams.filter(dream => 
        dream.status === 'complete' && 
        new Date(dream.created_at) > new Date(lastGeneratedAt)
      )
      
      // If there are newer completed dreams, refresh insights automatically
      if (newerDreams.length > 0) {
        console.log(`Found ${newerDreams.length} new dreams, refreshing insights`)
        await fetchInsights(true)
      }
    } catch (err) {
      console.error('Failed to check for newer dreams:', err)
      // Silently fail - user can still manually refresh
    }
  }

  useEffect(() => {
    loadInsights()
  }, [])

  const handleRefresh = () => {
    fetchInsights(true)
  }

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading your morning insights...</p>
        </div>
      </div>
    )
  }

  if (error || !insights) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || 'No insights available'}
          </p>
          <button
            onClick={() => fetchInsights()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const generated = new Date(timestamp)
    const diffMs = now.getTime() - generated.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`
    return generated.toLocaleDateString()
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Morning Insights
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Your dream wisdom for today • {insights.dreams_analyzed} dreams analyzed
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh insights"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pattern Insight */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Recent Pattern
              </h2>
              <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                {insights.pattern_insight}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Practice */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Today&apos;s Practice
                </h2>
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs">
                  <Clock className="w-3 h-3" />
                  {insights.today_practice.duration_minutes} min
                </span>
              </div>
              <p className="text-green-800 dark:text-green-200 leading-relaxed">
                {insights.today_practice.action}
              </p>
              {insights.today_practice.type === 'deeper' && (
                <p className="text-green-700 dark:text-green-300 text-sm mt-2 italic">
                  This deeper practice is recommended based on your recent patterns.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Integration Bridge */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Integration Bridge
              </h2>
              <p className="text-purple-800 dark:text-purple-200 leading-relaxed">
                {insights.integration_bridge}
              </p>
            </div>
          </div>
        </div>

        {/* Reflection Prompt */}
        <div className="lg:col-span-2 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Reflection Prompt
              </h2>
              <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                {insights.reflection_prompt}
              </p>
            </div>
          </div>
        </div>

        {/* Context Thread */}
        <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Longer Thread
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {insights.context_thread}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">
        Last updated {formatTimeAgo(insights.generated_at)}
      </div>
    </div>
  )
}