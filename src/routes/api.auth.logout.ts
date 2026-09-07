import { createFileRoute } from '@tanstack/react-router'
import { destroySession, jsonResponse, validOrigin } from '@/lib/auth.server'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!validOrigin(request))
          return jsonResponse({ error: 'Invalid request origin.' }, 403)
        try {
          await destroySession()
          return jsonResponse({ ok: true })
        } catch {
          return jsonResponse(
            { error: 'Could not sign out. Please try again.' },
            503,
          )
        }
      },
    },
  },
})
