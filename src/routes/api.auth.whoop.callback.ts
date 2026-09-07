import { createFileRoute } from '@tanstack/react-router'
import { consumeOAuthState, createSession } from '@/lib/auth.server'
import { equalTokens } from '@/lib/crypto.server'
import { connectWhoop, WhoopError } from '@/lib/whoop.server'

function redirect(error?: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: error ? `/?auth_error=${encodeURIComponent(error)}` : '/',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

export const Route = createFileRoute('/api/auth/whoop/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const params = new URL(request.url).searchParams
          const expectedState = await consumeOAuthState()
          const receivedState = params.get('state')
          if (
            !expectedState ||
            !receivedState ||
            !equalTokens(expectedState, receivedState)
          )
            return redirect('invalid_state')
          if (params.has('error')) return redirect('access_denied')
          const code = params.get('code')
          if (!code) return redirect('missing_code')
          await createSession(await connectWhoop(code))
          return redirect()
        } catch (error) {
          return redirect(
            error instanceof WhoopError ? error.code : 'connection_failed',
          )
        }
      },
    },
  },
})
