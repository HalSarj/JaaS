'use client'

import { useState } from 'react'
import { List, BarChart3 } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import DreamsList from '@/components/dreams-list'
import { DreamTimeline } from '@/components/dream-timeline'

export default function DreamsPage() {
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* View Toggle */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Your Dreams
            </h1>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Content */}
        <div className="flex-1">
          {viewMode === 'list' ? <DreamsList /> : <DreamTimeline />}
        </div>
      </div>
    </AppLayout>
  )
}