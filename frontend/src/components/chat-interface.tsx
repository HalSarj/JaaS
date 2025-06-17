'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Brain, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiClient } from '@/lib/api'
import { ChatMessage, DreamReference } from '@/types/chat'
import { cn, formatRelativeTime } from '@/lib/utils'

const SUGGESTED_PROMPTS = [
  "What do my recent anxiety dreams reveal about my current stress?",
  "Find patterns in my recurring symbols and what they mean",
  "What is my unconscious trying to tell me through these dreams?",
  "Show me how my dream themes have evolved over time",
  "What archetypal patterns appear most in my dreams?",
  "What does my shadow self reveal in these dreams?",
  "What collective symbols appear across my dream journal?",
  "What unresolved emotions keep appearing in my dreams?"
]

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dreamReferences, setDreamReferences] = useState<DreamReference[]>([])
  const [isReferencesExpanded, setIsReferencesExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await apiClient.sendChatMessage(input.trim(), messages)
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
        id: response.conversation_id
      }

      setMessages(prev => [...prev, assistantMessage])
      setDreamReferences(response.dream_references)
    } catch (error) {
      console.error('Chat error:', error)
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `I'm sorry, I encountered an error while processing your message. ${error instanceof Error ? error.message : 'Please try again.'}`,
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 relative">

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 pb-32 md:pb-24">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Start exploring your dreams
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Ask me anything about your dreams. I can analyze patterns, explain symbols, and help you understand recurring themes.
            </p>
            
            {/* Suggested Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-2xl mx-auto">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="p-3 sm:p-4 text-left text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors min-h-[44px] active:bg-slate-50 dark:active:bg-slate-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-3xl rounded-lg px-3 sm:px-4 py-2 sm:py-3",
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                  )}
                >
                  <div className="text-sm sm:text-base leading-relaxed break-words">
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-inherit">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc pl-4 text-inherit">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal pl-4 text-inherit">{children}</ol>,
                            li: ({ children }) => <li className="mb-1 text-inherit">{children}</li>,
                            h1: ({ children }) => <h1 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-inherit">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-inherit">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-2 first:mt-0 text-inherit">{children}</h3>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-purple-500 pl-4 italic my-2 text-inherit">
                                {children}
                              </blockquote>
                            ),
                            code: ({ children, className }) => {
                              const isInline = !className?.includes('language-')
                              return isInline ? (
                                <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm">
                                  {children}
                                </code>
                              ) : (
                                <code className={className}>{children}</code>
                              )
                            },
                            pre: ({ children }) => (
                              <pre className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg overflow-x-auto">
                                {children}
                              </pre>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-xs mt-2 opacity-70",
                      message.role === 'user'
                        ? 'text-blue-100'
                        : 'text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {formatRelativeTime(message.timestamp)}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm font-medium">U</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing your dreams...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Dream References */}
      {dreamReferences.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-16 left-0 right-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-10">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsReferencesExpanded(!isReferencesExpanded)}
            className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
          >
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Referenced Dreams ({dreamReferences.length})
            </div>
            <ChevronDown 
              className={cn(
                "w-4 h-4 text-slate-400 transition-transform duration-200",
                isReferencesExpanded ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
          
          {/* Expandable Content */}
          {isReferencesExpanded && (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 max-h-48 overflow-y-auto">
              <div className="overflow-x-auto">
                <div className="flex gap-2 pb-2 min-w-max">
                  {dreamReferences.map((dream) => (
                    <div
                      key={dream.id}
                      className="flex-shrink-0 bg-slate-50 dark:bg-slate-700 rounded-lg p-3 w-[160px] sm:w-[180px] border border-slate-200 dark:border-slate-600"
                    >
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">
                        {formatRelativeTime(dream.created_at)}
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 break-words overflow-hidden">
                        {dream.transcript?.substring(0, 70)}...
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        {Math.round(dream.similarity_score * 100)}% match
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-10">
        <div className="p-3 sm:p-4 pb-6 sm:pb-4 safe-area-inset-bottom">
        <div className="flex gap-2 sm:gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your dreams..."
            className="flex-1 resize-none border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 dark:text-slate-100 min-h-[44px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 transition-colors min-w-[44px] min-h-[44px] justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}