'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { X, Calendar, MessageSquare, Brain, Heart, Eye, BookOpen, Lightbulb, TrendingUp, Star, Download, Share2, Sun, Moon, BarChart3, Target, HelpCircle, Shield, Zap, Cog, Archive, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

  // Specialized formatting functions
  const formatSentimentAnalysis = (sentiment: {
    overall?: number;
    emotional_intensity?: number;
    progression?: number[];
    polarity_shifts?: number;
  }) => {
    if (!sentiment) return null;
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Overall Sentiment */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Overall Sentiment</h4>
                      <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${(sentiment.overall ?? 0) >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.abs(sentiment.overall ?? 0) * 100}%` }}
                />
              </div>
              <span className="text-sm font-mono">
                {(sentiment.overall ?? 0) > 0 ? '+' : ''}{((sentiment.overall ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
        </div>

        {/* Emotional Intensity */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">Emotional Intensity</h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-500"
                style={{ width: `${(sentiment.emotional_intensity || 0) * 100}%` }}
              />
            </div>
            <span className="text-sm font-mono">
              {((sentiment.emotional_intensity || 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Progression Timeline */}
        {sentiment.progression && sentiment.progression.length > 1 && (
          <div className="col-span-full bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
            <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">Emotional Journey</h4>
            <div className="flex items-end gap-1 h-16">
              {sentiment.progression.map((value: number, index: number) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full rounded-t transition-all duration-300 ${value >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ 
                      height: `${Math.max(Math.abs(value) * 100, 10)}%`,
                      minHeight: '4px'
                    }}
                  />
                  <span className="text-xs text-slate-500 mt-1">{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Beginning</span>
              <span>End</span>
            </div>
          </div>
        )}

        {/* Polarity Shifts */}
        {(sentiment.polarity_shifts ?? 0) > 0 && (
          <div className="col-span-full flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              {sentiment.polarity_shifts} emotional shift{sentiment.polarity_shifts !== 1 ? 's' : ''} detected
            </span>
          </div>
        )}
      </div>
    );
  };

  const formatJungianAnalysis = (jungian: {
    archetypes?: Array<{
      archetype: string;
      manifestation: string;
      strength: number;
      interpretation: string;
    }>;
    persona_vs_shadow?: {
      persona_elements?: string[];
      shadow_elements?: string[];
      integration_opportunities?: string[];
    };
    collective_symbols?: Array<{
      symbol: string;
      interpretation: string;
      confidence: number;
      cultural_context: string;
    }>;
  }) => {
    if (!jungian) return null;

    return (
      <div className="space-y-4">
        {/* Archetypes */}
        {jungian.archetypes && jungian.archetypes.length > 0 && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Archetypal Presences
            </h4>
            <div className="grid gap-3">
              {jungian.archetypes.map((archetype, index: number) => (
                <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-slate-800 dark:text-slate-200">{archetype.archetype}</h5>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div 
                          className="h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-blue-500"
                          style={{ width: `${(archetype.strength || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {((archetype.strength || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    <strong>Manifestation:</strong> {archetype.manifestation}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {archetype.interpretation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Persona vs Shadow */}
        {jungian.persona_vs_shadow && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Persona vs Shadow</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  Persona Elements
                </h5>
                <div className="space-y-1">
                  {jungian.persona_vs_shadow.persona_elements?.map((element: string, index: number) => (
                    <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">• {element}</div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 p-4 rounded-lg border border-slate-300 dark:border-slate-700">
                <h5 className="font-medium text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  Shadow Elements
                </h5>
                <div className="space-y-1">
                  {jungian.persona_vs_shadow.shadow_elements?.map((element: string, index: number) => (
                    <div key={index} className="text-sm text-slate-700 dark:text-slate-300">• {element}</div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Integration Opportunities */}
            {jungian.persona_vs_shadow.integration_opportunities && jungian.persona_vs_shadow.integration_opportunities.length > 0 && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h5 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Integration Opportunities
                </h5>
                <div className="space-y-1">
                  {jungian.persona_vs_shadow.integration_opportunities.map((opportunity: string, index: number) => (
                    <div key={index} className="text-sm text-green-700 dark:text-green-300">• {opportunity}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collective Symbols */}
        {jungian.collective_symbols && jungian.collective_symbols.length > 0 && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Collective Symbols</h4>
            <div className="grid gap-2">
              {jungian.collective_symbols.map((symbol, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium text-blue-800 dark:text-blue-200">{symbol.symbol}</h5>
                      <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {((symbol.confidence || 0) * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">{symbol.interpretation}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 italic">{symbol.cultural_context}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatSymbolAnalysis = (symbols: Array<{
    item: string;
    context: string;
    confidence?: number;
    emotional_charge?: number;
    interpretation: string;
    personal_associations?: string[];
    universal_meanings?: string[];
  }>) => {
    if (!symbols || !Array.isArray(symbols)) return null;

    return (
      <div className="grid gap-4">
        {symbols.map((symbol, index) => {
          const confidence = symbol.confidence || 0;
          const emotionalCharge = symbol.emotional_charge || 0;
          
          return (
            <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">{symbol.item}</h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    confidence >= 0.8 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  }`}>
                    {(confidence * 100).toFixed(0)}% confidence
                  </span>
                  <div className={`w-3 h-3 rounded-full ${
                    emotionalCharge > 0.2 ? 'bg-green-500' :
                    emotionalCharge < -0.2 ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} title={`Emotional charge: ${emotionalCharge.toFixed(2)}`} />
                </div>
              </div>
              
                             <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 italic">&ldquo;{symbol.context}&rdquo;</p>
              
              <div className="mb-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">Interpretation:</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{symbol.interpretation}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {symbol.personal_associations && symbol.personal_associations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Personal Associations</p>
                    <div className="flex flex-wrap gap-1">
                      {symbol.personal_associations.map((assoc: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded text-xs">
                          {assoc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {symbol.universal_meanings && symbol.universal_meanings.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Universal Meanings</p>
                    <div className="flex flex-wrap gap-1">
                      {symbol.universal_meanings.map((meaning: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded text-xs">
                          {meaning}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const formatEmotionalAnalysis = (emotions: {
    primary?: string[];
    secondary?: string[];
    emotional_arc?: {
      beginning?: string[];
      middle?: string[];
      end?: string[];
    };
  }) => {
    if (!emotions) return null;

    return (
      <div className="space-y-4">
        {/* Primary and Secondary Emotions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {emotions.primary && emotions.primary.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Primary Emotions</h4>
              <div className="flex flex-wrap gap-2">
                {emotions.primary.map((emotion: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full text-sm font-medium"
                  >
                    {emotion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {emotions.secondary && emotions.secondary.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Secondary Emotions</h4>
              <div className="flex flex-wrap gap-2">
                {emotions.secondary.map((emotion: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 rounded-full text-sm font-medium"
                  >
                    {emotion}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emotional Arc Timeline */}
        {emotions.emotional_arc && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Emotional Journey</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['beginning', 'middle', 'end'] as const).map((phase) => {
                const phaseEmotions = emotions.emotional_arc?.[phase];
                if (!phaseEmotions || phaseEmotions.length === 0) return null;
                
                return (
                  <div key={phase} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                    <h5 className="font-medium text-slate-700 dark:text-slate-300 mb-2 capitalize">{phase}</h5>
                    <div className="space-y-1">
                      {phaseEmotions.map((emotion: string, index: number) => (
                        <div key={index} className="text-sm text-slate-600 dark:text-slate-400">• {emotion}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatCognitiveAnalysis = (cognitive: {
    problem_solving?: {
      creative_solutions?: string[];
      rehearsal_scenarios?: string[];
      alternative_perspectives?: string[];
    };
    threat_simulation?: {
      present: boolean;
      type?: string;
      adaptive_value?: string;
    };
    emotional_regulation?: {
      coping_mechanisms?: string[];
      integration_attempts?: string[];
      unresolved_conflicts?: string[];
    };
    memory_consolidation?: {
      episodic_memories?: string[];
      procedural_learning?: string[];
      emotional_processing?: string[];
    };
  }) => {
    if (!cognitive) return null;

    return (
      <div className="space-y-6">
        {/* Cognitive Functions Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Problem Solving */}
          {cognitive.problem_solving && (
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-emerald-600" />
                <h4 className="font-medium text-emerald-800 dark:text-emerald-200">Problem Solving</h4>
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                {[
                  ...(cognitive.problem_solving.creative_solutions || []),
                  ...(cognitive.problem_solving.rehearsal_scenarios || []),
                  ...(cognitive.problem_solving.alternative_perspectives || [])
                ].length} insights detected
              </div>
            </div>
          )}

          {/* Threat Simulation */}
          {cognitive.threat_simulation && (
            <div className={`p-4 rounded-lg border ${
              cognitive.threat_simulation.present 
                ? 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800'
                : 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 border-slate-200 dark:border-slate-700'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Shield className={`w-4 h-4 ${cognitive.threat_simulation.present ? 'text-orange-600' : 'text-slate-500'}`} />
                <h4 className={`font-medium ${
                  cognitive.threat_simulation.present 
                    ? 'text-orange-800 dark:text-orange-200' 
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  Threat Simulation
                </h4>
              </div>
              <div className={`text-xs ${
                cognitive.threat_simulation.present 
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {cognitive.threat_simulation.present ? 'Active' : 'Inactive'}
              </div>
            </div>
          )}

          {/* Emotional Regulation */}
          {cognitive.emotional_regulation && (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-purple-600" />
                <h4 className="font-medium text-purple-800 dark:text-purple-200">Emotional Regulation</h4>
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">
                {(cognitive.emotional_regulation.coping_mechanisms?.length || 0)} mechanisms
              </div>
            </div>
          )}

          {/* Memory Consolidation */}
          {cognitive.memory_consolidation && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Archive className="w-4 h-4 text-blue-600" />
                <h4 className="font-medium text-blue-800 dark:text-blue-200">Memory Processing</h4>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {[
                  ...(cognitive.memory_consolidation.episodic_memories || []),
                  ...(cognitive.memory_consolidation.procedural_learning || []),
                  ...(cognitive.memory_consolidation.emotional_processing || [])
                ].length} memories processed
              </div>
            </div>
          )}
        </div>

        {/* Detailed Sections */}
        {/* Problem Solving Details */}
        {cognitive.problem_solving && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              Problem-Solving Patterns
            </h4>
            
            <div className="grid gap-4">
              {cognitive.problem_solving.creative_solutions && cognitive.problem_solving.creative_solutions.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h5 className="font-medium text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Creative Solutions
                  </h5>
                  <div className="space-y-2">
                    {cognitive.problem_solving.creative_solutions.map((solution, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">{solution}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cognitive.problem_solving.alternative_perspectives && cognitive.problem_solving.alternative_perspectives.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h5 className="font-medium text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    Alternative Perspectives
                  </h5>
                  <div className="space-y-2">
                    {cognitive.problem_solving.alternative_perspectives.map((perspective, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{perspective}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Threat Simulation Details */}
        {cognitive.threat_simulation?.present && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Threat Simulation Active
            </h4>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              {cognitive.threat_simulation.type && (
                <div className="mb-3">
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Threat Type: </span>
                  <span className="text-sm text-orange-700 dark:text-orange-300 capitalize">{cognitive.threat_simulation.type}</span>
                </div>
              )}
              {cognitive.threat_simulation.adaptive_value && (
                <div>
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Adaptive Value: </span>
                  <span className="text-sm text-orange-700 dark:text-orange-300">{cognitive.threat_simulation.adaptive_value}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emotional Regulation Details */}
        {cognitive.emotional_regulation && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Cog className="w-4 h-4 text-purple-500" />
              Emotional Regulation Strategies
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cognitive.emotional_regulation.coping_mechanisms && cognitive.emotional_regulation.coping_mechanisms.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h5 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Coping Mechanisms
                  </h5>
                  <div className="space-y-1">
                    {cognitive.emotional_regulation.coping_mechanisms.map((mechanism, index) => (
                      <div key={index} className="text-sm text-green-700 dark:text-green-300">• {mechanism}</div>
                    ))}
                  </div>
                </div>
              )}

              {cognitive.emotional_regulation.unresolved_conflicts && cognitive.emotional_regulation.unresolved_conflicts.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Unresolved Conflicts
                  </h5>
                  <div className="space-y-1">
                    {cognitive.emotional_regulation.unresolved_conflicts.map((conflict, index) => (
                      <div key={index} className="text-sm text-amber-700 dark:text-amber-300">• {conflict}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {cognitive.emotional_regulation.integration_attempts && cognitive.emotional_regulation.integration_attempts.length > 0 && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Integration Attempts
                </h5>
                <div className="space-y-1">
                  {cognitive.emotional_regulation.integration_attempts.map((attempt, index) => (
                    <div key={index} className="text-sm text-blue-700 dark:text-blue-300">• {attempt}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Memory Consolidation Details */}
        {cognitive.memory_consolidation && (
          <div>
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Archive className="w-4 h-4 text-blue-500" />
              Memory Consolidation Patterns
            </h4>
            
            <div className="grid gap-4">
              {[
                { key: 'episodic_memories', label: 'Episodic Memories', color: 'indigo', icon: BookOpen },
                { key: 'procedural_learning', label: 'Procedural Learning', color: 'green', icon: Cog },
                { key: 'emotional_processing', label: 'Emotional Processing', color: 'purple', icon: Heart }
              ].map(({ key, label, color, icon: Icon }) => {
                const memories = cognitive.memory_consolidation?.[key as keyof typeof cognitive.memory_consolidation] as string[] | undefined;
                if (!memories?.length) return null;

                return (
                  <div key={key} className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800 rounded-lg p-4`}>
                    <h5 className={`font-medium text-${color}-800 dark:text-${color}-200 mb-2 flex items-center gap-2`}>
                      <Icon className={`w-4 h-4 text-${color}-600`} />
                      {label}
                    </h5>
                    <div className="space-y-1">
                      {memories.map((memory, index) => (
                        <div key={index} className={`text-sm text-${color}-700 dark:text-${color}-300`}>• {memory}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatQuestionsToExplore = (questions: string[]) => {
    if (!questions || !Array.isArray(questions)) return null;

    return (
      <div className="grid gap-3">
        {questions.map((question, index) => (
          <div key={index} className="group border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{question}</p>
                {onChatWithDream && (
                  <button
                    onClick={() => {
                      onChatWithDream(dream, question);
                      onClose();
                    }}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Explore this question →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const formatAnalysisSection = (title: string, data: unknown, icon: React.ReactNode) => {
    if (!data) return null

    // Handle special cases with custom formatting
    if (title === 'Sentiment' && typeof data === 'object') {
      return (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            {icon}
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
            {formatSentimentAnalysis(data)}
          </div>
        </div>
      )
    }

    if (title.includes('Jungian') && typeof data === 'object') {
      return (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            {icon}
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
            {formatJungianAnalysis(data)}
          </div>
        </div>
      )
    }

    if (title === 'Symbols' && Array.isArray(data)) {
      return (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            {icon}
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
            {formatSymbolAnalysis(data)}
          </div>
        </div>
      )
    }

    if (title === 'Emotions' && typeof data === 'object') {
      return (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            {icon}
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
            {formatEmotionalAnalysis(data)}
          </div>
        </div>
      )
    }

    if (title === 'Questions To Explore' && Array.isArray(data)) {
      return (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            {icon}
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
            {formatQuestionsToExplore(data)}
          </div>
        </div>
      )
    }

    if (title.includes('Cognitive') && typeof data === 'object') {
      return (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            {icon}
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
            {formatCognitiveAnalysis(data)}
          </div>
        </div>
      )
    }

    // Default formatting for other sections
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
                             {formatAnalysisSection(
                               'Emotions',
                               dream.analysis.emotions,
                               getAnalysisIcon('emotions')
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