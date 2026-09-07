import { createFileRoute } from '@tanstack/react-router'
import { createOAuthState, jsonResponse } from '@/lib/auth.server'
import { env } from '@/lib/env.server'

export const Route = createFileRoute('/api/auth/whoop')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const config = env()
          const params = new URLSearchParams({
            client_id: config.WHOOP_CLIENT_ID,
            redirect_uri: config.WHOOP_REDIRECT_URI,
            response_type: 'code',
            scope: config.WHOOP_SCOPES,
            state: await createOAuthState(),
          })
          return new Response(null, {
            status: 302,
            headers: {
              Location: `https://api.prod.whoop.com/oauth/oauth2/auth?${params}`,
              'Cache-Control': 'no-store',
            },
          })
        } catch {
          return jsonResponse(
            { error: 'Server configuration needs attention.' },
            503,
          )
        }
      },
    },
  },
})
