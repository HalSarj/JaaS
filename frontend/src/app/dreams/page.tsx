import dynamic from 'next/dynamic'
import { AppLayout } from '@/components/app-layout'

// Dynamically import DreamsList to prevent SSR issues with Supabase
const DynamicDreamsList = dynamic(
  () => import('@/components/dreams-list'),
  { 
    ssr: false,
    loading: () => (
      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
        Loading dreams...
      </div>
    )
  }
)

export default function DreamsPage() {
  return (
    <AppLayout>
      <DynamicDreamsList />
    </AppLayout>
  )
}