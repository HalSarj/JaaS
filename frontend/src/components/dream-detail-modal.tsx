'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { X, Calendar, MessageSquare, Brain, Heart, Eye, BookOpen, Lightbulb, TrendingUp, Star, Download, Share2 } from 'lucide-react'
import { Dream } from '@/types/chat'
import { formatRelativeTime, cn } from '@/lib/utils'

interface DreamDetailModalProps {
  dream: Dream | null
  isOpen: boolean
  onClose: () => void
  onChatWithDream?: (dream: Dream, prompt?: string) => void
}

export function DreamDetailModal({ dream, isOpen, onClose, onChatWithDream }: DreamDetailModalProps) {
  const [selectedTab, setSelectedTab] = useState(0) // Default to Insights tab
  
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

  const getAnalysisIcon = (key: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      themes: <Brain className="w-5 h-5 text-purple-500" />,
      emotions: <Heart className="w-5 h-5 text-red-500" />,
      symbols: <Eye className="w-5 h-5 text-blue-500" />,
      psychological_insights: <Lightbulb className="w-5 h-5 text-green-500" />,
      narrative_structure: <BookOpen className="w-5 h-5 text-indigo-500" />,
      archetypal_patterns: <Star className="w-5 h-5 text-yellow-500" />,
      personal_connections: <TrendingUp className="w-5 h-5 text-orange-500" />
    }
    return iconMap[key] || <Brain className="w-5 h-5 text-slate-500" />
  }

  // Calculate dream insights score
  const getDreamScore = () => {
    if (!dream.analysis) return null
    const analysisKeys = Object.keys(dream.analysis).length
    const hasEmotions = dream.analysis.emotions?.primary?.length || 0
    const hasSymbols = Array.isArray(dream.analysis.symbols) ? dream.analysis.symbols.length : 0
    return Math.min(95, 40 + (analysisKeys * 8) + (hasEmotions * 3) + (hasSymbols * 2))
  }

  const handleExport = () => {
    const dreamData = {
      date: dream.created_at,
      transcript: dream.transcript,
      analysis: dream.analysis
    }
    const dataStr = JSON.stringify(dreamData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dream-${new Date(dream.created_at).toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Dream Analysis',
          text: `Dream from ${formatRelativeTime(dream.created_at)}: ${dream.transcript?.substring(0, 100)}...`,
        })
      } catch {
        console.log('Share cancelled')
      }
    } else {
      // Fallback: copy to clipboard
      const shareText = `Dream Analysis from ${formatRelativeTime(dream.created_at)}:\n\n${dream.transcript}`
      navigator.clipboard.writeText(shareText)
      // You could add a toast notification here
    }
  }

  const formatAnalysisSection = (title: string, data: unknown, icon: React.ReactNode) => {
    if (!data) return null

    return (
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          {icon}
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          {typeof data === 'string' ? (
            <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">{data}</p>
          ) : Array.isArray(data) ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {data.map((item, index) => (
                <span
                  key={index}
                  className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full text-xs sm:text-sm font-medium"
                >
                  {typeof item === 'string' ? item : item.item || item.name || String(item)}
                </span>
              ))}
            </div>
          ) : (
            <pre className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    )
  }

  const dreamScore = getDreamScore()
  
  const tabs = [
    { name: 'Insights', icon: <Lightbulb className="w-4 h-4" /> },
    { name: 'Analysis', icon: <Brain className="w-4 h-4" /> },
    { name: 'Overview', icon: <BookOpen className="w-4 h-4" /> }
  ]

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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel className="w-full max-w-sm sm:max-w-2xl md:max-w-4xl transform overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 text-left align-middle shadow-xl transition-all">
                {/* Enhanced Header */}
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm sm:text-base text-slate-600 dark:text-slate-400 truncate">
                          {formatRelativeTime(dream.created_at)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dream.status)} flex-shrink-0`}>
                          {dream.status}
                        </span>
                        {dreamScore && (
                          <div className="flex items-center gap-1 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 px-2 py-1 rounded-full">
                            <Star className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                              {dreamScore}% Analyzed
                            </span>
                          </div>
                        )}
                      </div>
                      <Dialog.Title
                        as="h2"
                        className="text-lg sm:text-xl md:text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100"
                      >
                        Dream Exploration
                      </Dialog.Title>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {dream.status === 'complete' && (
                        <>
                          <button
                            onClick={handleShare}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Share dream"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleExport}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Export dream data"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {dream.status === 'complete' && onChatWithDream && (
                        <button
                          onClick={() => {
                            // Create a context-aware prompt based on the dream analysis
                            const dreamSummary = dream.transcript?.substring(0, 150) + (dream.transcript && dream.transcript.length > 150 ? '...' : '')
                            const mainTheme = Array.isArray(dream.analysis?.themes) && dream.analysis.themes.length > 0 ? dream.analysis.themes[0] : null
                            const primaryEmotion = dream.analysis?.emotions?.primary?.[0]
                            const keySymbol = Array.isArray(dream.analysis?.symbols) && dream.analysis.symbols.length > 0 
                              ? (dream.analysis.symbols[0].item || dream.analysis.symbols[0]) 
                              : null

                            let contextPrompt = `I'd like to explore this dream from ${formatRelativeTime(dream.created_at)} in more depth:\n\n"${dreamSummary}"`
                            
                            if (mainTheme || primaryEmotion || keySymbol) {
                              contextPrompt += `\n\nThe analysis shows:`
                              if (mainTheme) contextPrompt += `\n• Main theme: ${mainTheme}`
                              if (primaryEmotion) contextPrompt += `\n• Primary emotion: ${primaryEmotion}`
                              if (keySymbol) contextPrompt += `\n• Key symbol: ${keySymbol}`
                            }
                            
                            contextPrompt += `\n\nWhat deeper meanings might this dream reveal about my unconscious mind or current life situation?`
                            
                            onChatWithDream(dream, contextPrompt)
                            onClose()
                          }}
                          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-sm sm:text-base min-h-[44px] shadow-lg"
                        >
                          <MessageSquare className="w-4 h-4 flex-shrink-0" />
                          <span className="hidden sm:inline">Explore with AI</span>
                          <span className="sm:hidden">Chat</span>
                        </button>
                      )}
                      <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                                 {/* Content Area */}
                 <div className="max-h-[calc(100vh-280px)] sm:max-h-[60vh] overflow-y-auto">
                   {dream.status === 'complete' && dream.analysis ? (
                     <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                       <Tab.List className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                         {tabs.map((tab) => (
                           <Tab
                             key={tab.name}
                             className={({ selected }) =>
                               cn(
                                 'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none',
                                 selected
                                   ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900'
                                   : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                               )
                             }
                           >
                             {tab.icon}
                             <span className="hidden sm:inline">{tab.name}</span>
                           </Tab>
                         ))}
                       </Tab.List>

                       <Tab.Panels className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                         {/* First Tab: Insights */}
                         <Tab.Panel>
                           <div className="space-y-4 sm:space-y-6">
                             <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                               Deep Insights
                             </h3>

                             {/* Quick Insights Summary */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                               {dream.analysis.emotions?.primary && (
                                 <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                   <div className="flex items-center gap-2 mb-1">
                                     <Heart className="w-4 h-4 text-red-500" />
                                     <span className="text-sm font-medium text-red-700 dark:text-red-300">Emotional Tone</span>
                                   </div>
                                   <p className="text-xs text-red-600 dark:text-red-400">
                                     {dream.analysis.emotions.primary.slice(0, 2).join(', ')}
                                   </p>
                                 </div>
                               )}
                               
                               {Array.isArray(dream.analysis.symbols) && dream.analysis.symbols.length > 0 && (
                                 <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                   <div className="flex items-center gap-2 mb-1">
                                     <Eye className="w-4 h-4 text-blue-500" />
                                     <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Key Symbols</span>
                                   </div>
                                   <p className="text-xs text-blue-600 dark:text-blue-400">
                                     {dream.analysis.symbols.slice(0, 2).map(s => s.item || s).join(', ')}
                                   </p>
                                 </div>
                               )}
                               
                               {Array.isArray(dream.analysis.themes) && dream.analysis.themes.length > 0 && (
                                 <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                   <div className="flex items-center gap-2 mb-1">
                                     <Brain className="w-4 h-4 text-purple-500" />
                                     <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Main Theme</span>
                                   </div>
                                   <p className="text-xs text-purple-600 dark:text-purple-400">
                                     {dream.analysis.themes[0]}
                                   </p>
                                 </div>
                               )}
                               
                               {dreamScore && (
                                 <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                   <div className="flex items-center gap-2 mb-1">
                                     <Star className="w-4 h-4 text-green-500" />
                                     <span className="text-sm font-medium text-green-700 dark:text-green-300">Analysis Depth</span>
                                   </div>
                                   <p className="text-xs text-green-600 dark:text-green-400">
                                     {dreamScore}% Complete
                                   </p>
                                 </div>
                               )}
                             </div>
                             
                             {/* Psychological Insights */}
                             {formatAnalysisSection(
                               'Psychological Insights',
                               dream.analysis.psychological_insights,
                               getAnalysisIcon('psychological_insights')
                             )}
                             
                             {/* Other analysis fields */}
                             {Object.entries(dream.analysis)
                               .filter(([key]) => !['themes', 'emotions', 'symbols', 'psychological_insights'].includes(key))
                               .map(([key, value]) => 
                                 formatAnalysisSection(
                                   key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                   value,
                                   getAnalysisIcon(key)
                                 )
                               )}

                             {/* Actionable Insights */}
                             <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                               <div className="flex items-start gap-3">
                                 <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                 <div>
                                   <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                                     Reflection Prompt
                                   </h4>
                                   <p className="text-sm text-amber-700 dark:text-amber-300">
                                     Consider exploring this dream further with our AI assistant. Ask about patterns, connections to your waking life, or deeper symbolic meanings.
                                   </p>
                                 </div>
                               </div>
                             </div>
                           </div>
                         </Tab.Panel>

                         {/* Second Tab: Analysis */}
                         <Tab.Panel>
                           <div className="space-y-4 sm:space-y-6">
                             <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                               Dream Analysis
                             </h3>
                             
                             {/* Themes */}
                             {formatAnalysisSection(
                               'Themes',
                               dream.analysis.themes,
                               getAnalysisIcon('themes')
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
                                 <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 space-y-3 border border-slate-200 dark:border-slate-700">
                                   {dream.analysis.emotions.primary && (
                                     <div>
                                       <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm sm:text-base">Primary</h4>
                                       <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                         {dream.analysis.emotions.primary.map((emotion: string, index: number) => (
                                           <span
                                             key={index}
                                             className="px-2 sm:px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full text-xs sm:text-sm font-medium"
                                           >
                                             {emotion}
                                           </span>
                                         ))}
                                       </div>
                                     </div>
                                   )}
                                   {dream.analysis.emotions.secondary && (
                                     <div>
                                       <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm sm:text-base">Secondary</h4>
                                       <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                         {dream.analysis.emotions.secondary.map((emotion: string, index: number) => (
                                           <span
                                             key={index}
                                             className="px-2 sm:px-3 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 rounded-full text-xs sm:text-sm font-medium"
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
                               getAnalysisIcon('symbols')
                             )}
                           </div>
                         </Tab.Panel>

                         {/* Third Tab: Overview */}
                         <Tab.Panel>
                           {dream.transcript && (
                             <div>
                               <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 sm:mb-3">
                                 Dream Transcript
                               </h3>
                               <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
                                 <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                                   {dream.transcript}
                                 </p>
                               </div>
                             </div>
                           )}
                         </Tab.Panel>
                       </Tab.Panels>
                     </Tab.Group>
                   ) : (
                     <div className="p-4 sm:p-6">
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

                       {/* Show transcript even if not complete */}
                       {dream.transcript && dream.status !== 'complete' && (
                         <div>
                           <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 sm:mb-3">
                             Dream Transcript
                           </h3>
                           <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
                             <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                               {dream.transcript}
                             </p>
                           </div>
                         </div>
                       )}
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