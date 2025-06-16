'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Calendar, MessageSquare, Brain, Heart, Eye } from 'lucide-react'
import { Dream } from '@/types/chat'
import { formatRelativeTime } from '@/lib/utils'

interface DreamDetailModalProps {
  dream: Dream | null
  isOpen: boolean
  onClose: () => void
  onChatWithDream?: (dream: Dream) => void
}

export function DreamDetailModal({ dream, isOpen, onClose, onChatWithDream }: DreamDetailModalProps) {
  if (!dream) return null

  const getStatusColor = (status: Dream['status']) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'analyzing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'transcribing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const formatAnalysisSection = (title: string, data: unknown, icon: React.ReactNode) => {
    if (!data) return null

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
          {typeof data === 'string' ? (
            <p className="text-slate-700 dark:text-slate-300">{data}</p>
          ) : Array.isArray(data) ? (
            <div className="flex flex-wrap gap-2">
              {data.map((item, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full text-sm"
                >
                  {typeof item === 'string' ? item : item.item || item.name || String(item)}
                </span>
              ))}
            </div>
          ) : (
            <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    )
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      <span className="text-slate-600 dark:text-slate-400">
                        {formatRelativeTime(dream.created_at)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dream.status)}`}>
                        {dream.status}
                      </span>
                    </div>
                    <Dialog.Title
                      as="h2"
                      className="text-2xl font-bold leading-6 text-slate-900 dark:text-slate-100"
                    >
                      Dream Details
                    </Dialog.Title>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {dream.status === 'complete' && onChatWithDream && (
                      <button
                        onClick={() => onChatWithDream(dream)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Ask about this dream
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Transcript */}
                  {dream.transcript && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        Dream Transcript
                      </h3>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {dream.transcript}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Analysis */}
                  {dream.analysis && dream.status === 'complete' && (
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                        Dream Analysis
                      </h3>
                      
                      {/* Themes */}
                      {formatAnalysisSection(
                        'Themes',
                        dream.analysis.themes,
                        <Brain className="w-5 h-5 text-purple-500" />
                      )}
                      
                      {/* Emotions */}
                      {dream.analysis.emotions && (
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Heart className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                              Emotions
                            </h3>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
                            {dream.analysis.emotions.primary && (
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Primary</h4>
                                <div className="flex flex-wrap gap-2">
                                  {dream.analysis.emotions.primary.map((emotion: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full text-sm"
                                    >
                                      {emotion}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dream.analysis.emotions.secondary && (
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Secondary</h4>
                                <div className="flex flex-wrap gap-2">
                                  {dream.analysis.emotions.secondary.map((emotion: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 rounded-full text-sm"
                                    >
                                      {emotion}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Symbols */}
                      {formatAnalysisSection(
                        'Symbols',
                        dream.analysis.symbols,
                        <Eye className="w-5 h-5 text-blue-500" />
                      )}
                      
                      {/* Psychological Insights */}
                      {formatAnalysisSection(
                        'Psychological Insights',
                        dream.analysis.psychological_insights,
                        <Brain className="w-5 h-5 text-green-500" />
                      )}
                      
                      {/* Other analysis fields */}
                      {Object.entries(dream.analysis)
                        .filter(([key]) => !['themes', 'emotions', 'symbols', 'psychological_insights'].includes(key))
                        .map(([key, value]) => 
                          formatAnalysisSection(
                            key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            value,
                            <Brain className="w-5 h-5 text-slate-500" />
                          )
                        )}
                    </div>
                  )}

                  {/* Loading states */}
                  {dream.status === 'transcribing' && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-400">Transcribing your dream...</p>
                    </div>
                  )}

                  {dream.status === 'analyzing' && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-400">Analyzing your dream...</p>
                    </div>
                  )}

                  {dream.status === 'failed' && (
                    <div className="text-center py-8">
                      <p className="text-red-600 dark:text-red-400">
                        Failed to process this dream. Please try uploading again.
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}