import { createFileRoute } from '@tanstack/react-router'
import { currentUserId, jsonResponse } from '@/lib/auth.server'
import { dashboardData } from '@/lib/whoop.server'

export const Route = createFileRoute('/api/dashboard')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const userId = await currentUserId()
          if (!userId) return jsonResponse({ error: 'unauthorized' }, 401)
          return jsonResponse(await dashboardData(userId))
        } catch {
          return jsonResponse(
            { error: 'Could not load your dashboard. Please try again.' },
            503,
          )
        }
      },
    },
  },
})
