import { AppLayout } from '@/components/app-layout'
import { MorningDashboard } from '@/components/morning-dashboard'

export default function Home() {
  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <MorningDashboard />
        </div>
      </div>
    </AppLayout>
  )
}
