import '@tanstack/react-start/server-only'
import { db } from './db.server'
import { env } from './env.server'
import { equalTokens } from './crypto.server'
import { normalizeEmail } from './allowlist'
import { dashboardData, syncWhoop } from './whoop.server'
import type { McpDataSource } from './mcp'

const noStore = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

// Bearer authentication for /api/mcp. One shared secret from MCP_BEARER_TOKEN;
// an unset token means the endpoint refuses everything rather than opening up.
export function authorizeMcp(request: Request): Response | null {
  let expected: string | undefined
  try {
    expected = env().MCP_BEARER_TOKEN
  } catch {
    return Response.json(
      { error: 'server_misconfigured' },
      { status: 503, headers: noStore },
    )
  }
  if (!expected)
    return Response.json(
      {
        error: 'mcp_not_configured',
        message:
          'Set MCP_BEARER_TOKEN (32+ characters) to enable the MCP endpoint.',
      },
      { status: 503, headers: noStore },
    )
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match || !equalTokens(match[1], expected))
    return Response.json(
      { error: 'unauthorized' },
      {
        status: 401,
        headers: {
          ...noStore,
          'WWW-Authenticate': 'Bearer realm="FORM MCP", error="invalid_token"',
        },
      },
    )
  return null
}

// The single allowed account, resolved from the allowlist rather than a session.
async function allowedUserId() {
  const [row] = await db()<{ user_id: string }[]>`
    select user_id from whoop_dashboard.connections
    where lower(trim(email)) = ${normalizeEmail(env().WHOOP_ALLOWED_EMAIL)}
    limit 1`
  return row ? String(row.user_id) : null
}

export function mcpDataSource(): McpDataSource {
  return {
    load: async () => {
      const userId = await allowedUserId()
      return userId ? dashboardData(userId) : null
    },
    sync: async () => {
      const userId = await allowedUserId()
      if (!userId) throw new Error('reconnect_required')
      return syncWhoop(userId)
    },
  }
}
