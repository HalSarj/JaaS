'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Eye, Brain, TrendingUp, Circle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Dream, DreamAnalysis } from '@/types/chat'
import { formatRelativeTime, cn } from '@/lib/utils'
import { DreamDetailModal } from './dream-detail-modal'

interface TimelineGroup {
  date: string
  dreams: Dream[]
}

interface PatternData {
  themes: { [key: string]: number }
  emotions: { [key: string]: number }
  symbols: { [key: string]: number }
}

export function DreamTimeline() {
  const [dreams, setDreams] = useState<Dream[]>([])
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([])
  const [patternData, setPatternData] = useState<PatternData>({ themes: {}, emotions: {}, symbols: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('week')

  useEffect(() => {
    loadDreams()
  }, [])

  useEffect(() => {
    if (dreams.length > 0) {
      groupDreamsByDate()
      calculatePatterns()
    }
  }, [dreams, groupBy])

  const loadDreams = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.getDreams()
      setDreams(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dreams')
    } finally {
      setIsLoading(false)
    }
  }

  const groupDreamsByDate = () => {
    const groups: { [key: string]: Dream[] } = {}
    
    dreams.forEach(dream => {
      const date = new Date(dream.created_at)
      let groupKey: string
      
      switch (groupBy) {
        case 'day':
          groupKey = date.toISOString().split('T')[0]
          break
        case 'week':
          const startOfWeek = new Date(date)
          startOfWeek.setDate(date.getDate() - date.getDay())
          groupKey = startOfWeek.toISOString().split('T')[0]
          break
        case 'month':
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        default:
          groupKey = date.toISOString().split('T')[0]
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(dream)
    })

    const timelineGroups: TimelineGroup[] = Object.entries(groups)
      .map(([date, dreams]) => ({ date, dreams }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setTimelineGroups(timelineGroups)
  }

  const calculatePatterns = () => {
    const patterns: PatternData = { themes: {}, emotions: {}, symbols: {} }
    
    dreams.forEach(dream => {
      if (dream.analysis) {
        // Count themes
        if (dream.analysis.themes) {
          dream.analysis.themes.forEach(theme => {
            patterns.themes[theme] = (patterns.themes[theme] || 0) + 1
          })
        }
        
        // Count emotions
        if (dream.analysis.emotions?.primary) {
          dream.analysis.emotions.primary.forEach(emotion => {
            patterns.emotions[emotion] = (patterns.emotions[emotion] || 0) + 1
          })
        }
        
        // Count symbols
        if (dream.analysis.symbols) {
          dream.analysis.symbols.forEach(symbol => {
            if (symbol.item) {
              patterns.symbols[symbol.item] = (patterns.symbols[symbol.item] || 0) + 1
            }
          })
        }
      }
    })
    
    setPatternData(patterns)
  }

  const getStatusColor = (status: Dream['status']) => {
    switch (status) {
      case 'complete': return 'bg-green-500'
      case 'analyzing': return 'bg-blue-500'
      case 'transcribing': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getThemeColor = (theme: string): string => {
    const colors = [
      'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ]
    const hash = theme.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const getMainTheme = (analysis: DreamAnalysis | null): string => {
    if (!analysis) return 'Processing...'
    if (analysis.themes && analysis.themes.length > 0) {
      return analysis.themes[0]
    }
    if (analysis.emotions?.primary && analysis.emotions.primary.length > 0) {
      return analysis.emotions.primary[0]
    }
    return 'No themes detected'
  }

  const formatGroupDate = (date: string, groupBy: string): string => {
    const d = new Date(date)
    
    switch (groupBy) {
      case 'day':
        return d.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      case 'week':
        const endOfWeek = new Date(d)
        endOfWeek.setDate(d.getDate() + 6)
        return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      case 'month':
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      default:
        return date
    }
  }

  const handleDreamClick = (dream: Dream) => {
    setSelectedDream(dream)
    setIsModalOpen(true)
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
        Loading timeline...
      </div>
    )
  }

  if (dreams.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
        No dreams to display in timeline view.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Controls and Pattern Overview */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">Group by:</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        
        {/* Pattern Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="font-medium text-slate-900 dark:text-slate-100">Top Themes</span>
            </div>
            <div className="space-y-1">
              {Object.entries(patternData.themes)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([theme, count]) => (
                  <div key={theme} className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 truncate">{theme}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{count}</span>
                  </div>
                ))
              }
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-slate-900 dark:text-slate-100">Emotions</span>
            </div>
            <div className="space-y-1">
              {Object.entries(patternData.emotions)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 truncate">{emotion}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{count}</span>
                  </div>
                ))
              }
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-green-500" />
              <span className="font-medium text-slate-900 dark:text-slate-100">Symbols</span>
            </div>
            <div className="space-y-1">
              {Object.entries(patternData.symbols)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([symbol, count]) => (
                  <div key={symbol} className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 truncate">{symbol}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{count}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
          
          <div className="space-y-6 sm:space-y-8">
            {timelineGroups.map((group, groupIndex) => (
              <div key={group.date} className="relative">
                {/* Date Marker */}
                <div className="flex items-center mb-4">
                  <div className="relative z-10 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full p-2 mr-4">
                    <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {formatGroupDate(group.date, groupBy)}
                  </h3>
                </div>
                
                {/* Dreams in this group */}
                <div className="ml-12 space-y-3">
                  {group.dreams.map((dream, dreamIndex) => {
                    const mainTheme = getMainTheme(dream.analysis)
                    const themeColor = getThemeColor(mainTheme)
                    
                    return (
                      <div
                        key={dream.id}
                        onClick={() => handleDreamClick(dream)}
                        className="relative cursor-pointer group"
                      >
                        {/* Dream Card */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={cn('w-3 h-3 rounded-full', getStatusColor(dream.status))}></div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatRelativeTime(dream.created_at)}
                              </span>
                            </div>
                            <div className={cn('px-2 py-1 rounded-full text-xs font-medium text-white', themeColor)}>
                              {mainTheme}
                            </div>
                          </div>
                          
                          {dream.transcript && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                              {dream.transcript.substring(0, 150)}
                              {dream.transcript.length > 150 && '...'}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
                            {dream.analysis?.emotions?.primary && (
                              <div className="flex items-center gap-1">
                                <Circle className="w-3 h-3 fill-current text-blue-400" />
                                <span>{dream.analysis.emotions.primary.slice(0, 2).join(', ')}</span>
                              </div>
                            )}
                            {dream.analysis?.symbols && dream.analysis.symbols.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Eye className="w-3 h-3 text-green-400" />
                                <span>{dream.analysis.symbols.length} symbols</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Connection line to timeline */}
                        <div className="absolute left-0 top-6 w-4 h-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-4"></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dream Detail Modal */}
      <DreamDetailModal
        dream={selectedDream}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChatWithDream={() => {}}
      />
    </div>
  )
}