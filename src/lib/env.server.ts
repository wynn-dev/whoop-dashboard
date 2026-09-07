import '@tanstack/react-start/server-only'
import { z } from 'zod'

const schema = z.object({
  WHOOP_CLIENT_ID: z.string().min(1),
  WHOOP_CLIENT_SECRET: z.string().min(1),
  WHOOP_ALLOWED_EMAIL: z.email(),
  APP_URL: z.url(),
  WHOOP_REDIRECT_URI: z.url(),
  WHOOP_SCOPES: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  // Optional. When set, /api/mcp accepts requests carrying this bearer token.
  MCP_BEARER_TOKEN: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined,
    z.string().min(32).optional(),
  ),
})

export function env() {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `Invalid server configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    )
  }
  const config = result.data
  if (
    new URL(config.APP_URL).origin !== new URL(config.WHOOP_REDIRECT_URI).origin
  ) {
    throw new Error('APP_URL and WHOOP_REDIRECT_URI must share an origin.')
  }
  const scopes = config.WHOOP_SCOPES.split(/\s+/)
  for (const scope of [
    'offline',
    'read:profile',
    'read:cycles',
    'read:recovery',
    'read:sleep',
    'read:workout',
  ]) {
    if (!scopes.includes(scope))
      throw new Error(`WHOOP_SCOPES must include ${scope}.`)
  }
  return config
}
