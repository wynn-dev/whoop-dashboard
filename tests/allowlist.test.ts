import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAllowedEmail, normalizeEmail } from '../src/lib/allowlist'

const inserts: string[] = []
vi.mock('../src/lib/db.server', () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    inserts.push(strings.join('?') + ' :: ' + JSON.stringify(values))
    return Promise.resolve([])
  }
  return { db: () => sql, getConnection: vi.fn() }
})

const allowed = 'Owner@Example.com'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
function whoopServer(profileEmail: string) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('/oauth/oauth2/token'))
        return json({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: 'offline read:profile',
        })
      if (url.includes('/user/profile/basic'))
        return json({
          user_id: 4242,
          email: profileEmail,
          first_name: 'Sam',
          last_name: 'Rivera',
        })
      return json({ error: 'unexpected' }, 500)
    }),
  )
  return calls
}

describe('single-account allowlist', () => {
  it('compares addresses case- and whitespace-insensitively and rejects blanks', () => {
    expect(normalizeEmail('  Owner@Example.com ')).toBe('owner@example.com')
    expect(isAllowedEmail('owner@example.com', allowed)).toBe(true)
    expect(isAllowedEmail(' OWNER@example.COM ', allowed)).toBe(true)
    expect(isAllowedEmail('someone.else@example.com', allowed)).toBe(false)
    expect(isAllowedEmail('owner@example.co', allowed)).toBe(false)
    expect(isAllowedEmail('', allowed)).toBe(false)
    expect(isAllowedEmail('   ', '   ')).toBe(false)
  })
})

describe('connectWhoop enforces the allowlist before storing anything', () => {
  beforeEach(() => {
    inserts.length = 0
    Object.assign(process.env, {
      WHOOP_CLIENT_ID: 'client',
      WHOOP_CLIENT_SECRET: 'secret',
      WHOOP_ALLOWED_EMAIL: allowed,
      APP_URL: 'http://localhost:3001',
      WHOOP_REDIRECT_URI: 'http://localhost:3001/api/auth/whoop/callback',
      WHOOP_SCOPES:
        'read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout offline',
      SESSION_SECRET: 'x'.repeat(48),
      TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rejects any other WHOOP account with account_not_allowed and writes nothing', async () => {
    const calls = whoopServer('intruder@example.com')
    const { connectWhoop, WhoopError } = await import('../src/lib/whoop.server')
    await expect(connectWhoop('auth-code')).rejects.toMatchObject({
      code: 'account_not_allowed',
      status: 403,
    })
    await expect(connectWhoop('auth-code')).rejects.toBeInstanceOf(WhoopError)
    expect(inserts).toEqual([])
    expect(calls.some((url) => url.includes('/user/profile/basic'))).toBe(true)
  })

  it('accepts the allowed account regardless of case and stores encrypted tokens', async () => {
    whoopServer('owner@EXAMPLE.com')
    const { connectWhoop } = await import('../src/lib/whoop.server')
    await expect(connectWhoop('auth-code')).resolves.toBe('4242')
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toContain('insert into whoop_dashboard.connections')
    expect(inserts[0]).not.toContain('access-token')
    expect(inserts[0]).not.toContain('refresh-token')
  })
})
