import { createFileRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dashboard } from '@/components/dashboard'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <Dashboard />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
