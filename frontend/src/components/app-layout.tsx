'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, FileText, Menu, X, Lock } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Chat', href: '/', icon: MessageSquare },
  { name: 'Dreams', href: '/dreams', icon: FileText },
]

interface AppLayoutProps {
  children: React.ReactNode
}

function PasswordPrompt({ onCorrectPassword }: { onCorrectPassword: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const requiredPassword = process.env.NEXT_PUBLIC_APP_PASSWORD
    
    if (!requiredPassword) {
      // If no password is set, allow access
      onCorrectPassword()
      return
    }

    if (password === requiredPassword) {
      localStorage.setItem('dream-app-authenticated', 'true')
      onCorrectPassword()
    } else {
      setError('Incorrect password')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Jung as a Service
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">
            Please enter the password to access your dream analysis
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-slate-100 text-base min-h-[44px]"                            
              disabled={loading}
            />
          </div>
          
          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors min-h-[44px] text-base"
          >
            {loading ? 'Checking...' : 'Access App'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Check if password protection is enabled
    const requiredPassword = process.env.NEXT_PUBLIC_APP_PASSWORD
    
    if (!requiredPassword) {
      // No password required, allow access
      setIsAuthenticated(true)
      setIsLoading(false)
      return
    }

    // Check if user is already authenticated
    const isAuth = localStorage.getItem('dream-app-authenticated') === 'true'
    setIsAuthenticated(isAuth)
    setIsLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('dream-app-authenticated')
    setIsAuthenticated(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <PasswordPrompt onCorrectPassword={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-600 opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-14 sm:h-16 px-4 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
            Jung as a Service
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="mt-6 sm:mt-8 px-4">
          <ul className="space-y-1 sm:space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors min-h-[44px]",
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>

          {process.env.NEXT_PUBLIC_APP_PASSWORD && (
            <div className="mt-6 sm:mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 sm:py-2 rounded-lg text-sm sm:text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 w-full min-h-[44px] active:bg-red-100 dark:active:bg-red-900/30"
              >
                <Lock className="w-5 h-5 flex-shrink-0" />
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:pl-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between h-14 sm:h-16 px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
            Jung as a Service
          </h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Page content */}
        <main className="flex-1 min-h-0">
          {children}
        </main>
      </div>
    </div>
  )
}