import { createFileRoute } from '@tanstack/react-router'
import { currentUserId, jsonResponse, validOrigin } from '@/lib/auth.server'
import { syncWhoop, WhoopError } from '@/lib/whoop.server'

export const Route = createFileRoute('/api/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!validOrigin(request))
          return jsonResponse({ error: 'Invalid request origin.' }, 403)
        try {
          const userId = await currentUserId()
          if (!userId) return jsonResponse({ error: 'unauthorized' }, 401)
          return jsonResponse(await syncWhoop(userId))
        } catch (error) {
          return jsonResponse(
            { error: error instanceof WhoopError ? error.code : 'sync_failed' },
            502,
          )
        }
      },
    },
  },
})
