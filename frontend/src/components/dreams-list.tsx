'use client'

import { useState, useEffect } from 'react'
import { Search, Calendar, MessageSquare } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Dream, DreamAnalysis } from '@/types/chat'
import { formatRelativeTime, truncateText } from '@/lib/utils'
import { DreamDetailModal } from './dream-detail-modal'

interface DreamsListProps {
  onDreamSelect?: (dream: Dream) => void
}

function DreamsList({ onDreamSelect }: DreamsListProps) {
  const [dreams, setDreams] = useState<Dream[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    loadDreams()
  }, [])

  const loadDreams = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.getDreams()
      setDreams(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dreams')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      try {
        const results = await apiClient.searchDreams(query)
        setDreams(results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      }
    } else {
      loadDreams()
    }
  }

  const getStatusColor = (status: Dream['status']) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'analyzing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'transcribing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
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

  const handleDreamClick = (dream: Dream) => {
    setSelectedDream(dream)
    setIsModalOpen(true)
  }

  const handleChatWithDream = (dream: Dream) => {
    setIsModalOpen(false)
    onDreamSelect?.(dream)
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Your Dreams
        </h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search dreams..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Dreams List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-slate-500 dark:text-slate-400">
            Loading dreams...
          </div>
        ) : dreams.length === 0 ? (
          <div className="p-6 text-center text-slate-500 dark:text-slate-400">
            {searchQuery ? 'No dreams found matching your search.' : 'No dreams recorded yet.'}
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {dreams.map((dream) => (
              <div
                key={dream.id}
                onClick={() => handleDreamClick(dream)}
                className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer transition-colors bg-white dark:bg-slate-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {formatRelativeTime(dream.created_at)}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dream.status)}`}>
                    {dream.status}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                    {getMainTheme(dream.analysis)}
                  </div>
                  {dream.transcript && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {truncateText(dream.transcript, 120)}
                    </p>
                  )}
                </div>

                {dream.status === 'complete' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleChatWithDream(dream)
                    }}
                    className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Ask about this dream
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dream Detail Modal */}
      <DreamDetailModal
        dream={selectedDream}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChatWithDream={handleChatWithDream}
      />
    </div>
  )
}

export default DreamsList