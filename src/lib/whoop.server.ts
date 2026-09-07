import '@tanstack/react-start/server-only'
import { z } from 'zod'
import type postgres from 'postgres'
import { db, getConnection, type ConnectionRow } from './db.server'
import { env } from './env.server'
import { encryptToken, decryptToken } from './crypto.server'
import type { RecordKind, WhoopRecord } from './whoop'

const API = 'https://api.prod.whoop.com/developer/v2'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
})
const profileSchema = z.object({
  user_id: z.number().int(),
  email: z.email(),
  first_name: z.string(),
  last_name: z.string(),
})

export class WhoopError extends Error {
  constructor(
    public code: string,
    public status = 502,
  ) {
    super(code)
  }
}

async function requestTokens(body: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok)
    throw new WhoopError(
      response.status === 400 || response.status === 401
        ? 'reconnect_required'
        : 'whoop_unavailable',
      response.status,
    )
  const parsed = tokenSchema.safeParse(await response.json())
  if (!parsed.success) throw new WhoopError('missing_refresh_token')
  return parsed.data
}

export async function connectWhoop(code: string) {
  const config = env()
  const tokens = await requestTokens(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.WHOOP_REDIRECT_URI,
      client_id: config.WHOOP_CLIENT_ID,
      client_secret: config.WHOOP_CLIENT_SECRET,
    }),
  )
  const response = await fetch(`${API}/user/profile/basic`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new WhoopError('profile_unavailable')
  const profile = profileSchema.parse(await response.json())
  if (
    profile.email.trim().toLowerCase() !==
    config.WHOOP_ALLOWED_EMAIL.trim().toLowerCase()
  )
    throw new WhoopError('account_not_allowed', 403)
  const userId = String(profile.user_id)
  await db()`insert into whoop_dashboard.connections
    (user_id, email, first_name, last_name, access_token, refresh_token, expires_at, scopes)
    values (${userId}, ${profile.email}, ${profile.first_name}, ${profile.last_name},
      ${encryptToken(tokens.access_token, config.TOKEN_ENCRYPTION_KEY)}, ${encryptToken(tokens.refresh_token, config.TOKEN_ENCRYPTION_KEY)},
      ${new Date(Date.now() + tokens.expires_in * 1000)}, ${tokens.scope ?? config.WHOOP_SCOPES})
    on conflict (user_id) do update set email = excluded.email, first_name = excluded.first_name,
      last_name = excluded.last_name, access_token = excluded.access_token, refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at, scopes = excluded.scopes, needs_reconnect = false, sync_error = null`
  return userId
}

export async function accessToken(
  userId: string,
  rejectedToken?: string,
): Promise<string> {
  // A row lock serializes refreshes across tabs, server instances, and workers.
  // Always reread inside the lock: another request may already have rotated it.
  return db().begin(async (sql) => {
    const [connection] = await sql<
      ConnectionRow[]
    >`select * from whoop_dashboard.connections where user_id = ${userId} for update`
    if (!connection || connection.needs_reconnect)
      throw new WhoopError('reconnect_required', 401)
    const config = env()
    const current = decryptToken(
      connection.access_token,
      config.TOKEN_ENCRYPTION_KEY,
    )
    if (
      connection.expires_at.getTime() > Date.now() + 60_000 &&
      current !== rejectedToken
    )
      return current
    const tokens = await requestTokens(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptToken(
          connection.refresh_token,
          config.TOKEN_ENCRYPTION_KEY,
        ),
        client_id: config.WHOOP_CLIENT_ID,
        client_secret: config.WHOOP_CLIENT_SECRET,
        scope: 'offline',
      }),
    )
    await sql`update whoop_dashboard.connections set
      access_token = ${encryptToken(tokens.access_token, config.TOKEN_ENCRYPTION_KEY)},
      refresh_token = ${encryptToken(tokens.refresh_token, config.TOKEN_ENCRYPTION_KEY)},
      expires_at = ${new Date(Date.now() + tokens.expires_in * 1000)} where user_id = ${userId}`
    return tokens.access_token
  }) as Promise<string>
}

async function getPage(userId: string, path: string, params: URLSearchParams) {
  let token = await accessToken(userId)
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${API}${path}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (response.status === 401 && attempt === 0) {
      token = await accessToken(userId, token)
      continue
    }
    if (response.status === 401 || response.status === 403)
      throw new WhoopError('reconnect_required', 401)
    if (response.status === 429) {
      const delay = Number(
        response.headers.get('Retry-After') ??
          response.headers.get('X-RateLimit-Reset') ??
          '5',
      )
      if (attempt === 3 || !Number.isFinite(delay) || delay > 30)
        throw new WhoopError('rate_limited', 429)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(1, delay) * 1000),
      )
      continue
    }
    if (!response.ok) throw new WhoopError('whoop_unavailable')
    const payload = z
      .object({
        records: z.array(z.record(z.string(), z.unknown())),
        next_token: z.string().nullish(),
      })
      .parse(await response.json())
    return {
      records: payload.records as WhoopRecord[],
      nextToken: payload.next_token,
    }
  }
  throw new WhoopError('whoop_unavailable')
}

const endpoints: Record<RecordKind, string> = {
  cycle: '/cycle',
  recovery: '/recovery',
  sleep: '/activity/sleep',
  workout: '/activity/workout',
}

export async function syncWhoop(userId: string) {
  const [locked] =
    await db()`update whoop_dashboard.connections set sync_started_at = now(), sync_error = null
    where user_id = ${userId} and (sync_started_at is null or sync_started_at < now() - interval '10 minutes') returning user_id`
  if (!locked) return { syncing: true }
  try {
    const end = new Date()
    const start = new Date(end.getTime() - 90 * 86_400_000)
    const collections: Record<RecordKind, WhoopRecord[]> = {
      cycle: [],
      recovery: [],
      sleep: [],
      workout: [],
    }
    for (const kind of ['cycle', 'sleep', 'recovery', 'workout'] as const) {
      const params = new URLSearchParams({
        limit: '25',
        start: start.toISOString(),
        end: end.toISOString(),
      })
      const seenTokens = new Set<string>()
      for (let page = 0; page < 100; page++) {
        const result = await getPage(userId, endpoints[kind], params)
        collections[kind].push(...result.records)
        await db()`update whoop_dashboard.connections set sync_started_at = now() where user_id = ${userId}`
        // Keep one account's import under WHOOP's 100 requests/minute budget.
        await new Promise((resolve) => setTimeout(resolve, 700))
        if (!result.nextToken) break
        if (page === 99 || seenTokens.has(result.nextToken))
          throw new WhoopError('incomplete_import')
        seenTokens.add(result.nextToken)
        params.set('nextToken', result.nextToken)
      }
    }
    const cycleStarts = new Map(
      collections.cycle.map((cycle) => [String(cycle.id), cycle.start]),
    )
    await db().begin(async (sql) => {
      for (const kind of Object.keys(collections) as RecordKind[]) {
        const ids: string[] = []
        for (const record of collections[kind]) {
          const id = String(kind === 'recovery' ? record.cycle_id : record.id)
          const startedAt =
            kind === 'recovery'
              ? (cycleStarts.get(String(record.cycle_id)) ?? record.created_at)
              : record.start
          if (
            !startedAt ||
            id === 'undefined' ||
            Number.isNaN(new Date(startedAt).getTime())
          )
            throw new WhoopError('invalid_record')
          ids.push(id)
          await sql`insert into whoop_dashboard.records (user_id, kind, record_id, start_at, data)
            values (${userId}, ${kind}, ${id}, ${new Date(startedAt)}, ${sql.json(record as postgres.JSONValue)})
            on conflict (user_id, kind, record_id) do update set start_at = excluded.start_at, data = excluded.data, updated_at = now()`
        }
        // Reconcile deletions only after every page was successfully downloaded.
        if (ids.length) {
          await sql`delete from whoop_dashboard.records where user_id = ${userId} and kind = ${kind}
            and start_at >= ${start} and start_at < ${end} and record_id not in ${sql(ids)}`
        } else {
          await sql`delete from whoop_dashboard.records where user_id = ${userId} and kind = ${kind} and start_at >= ${start} and start_at < ${end}`
        }
      }
      await sql`update whoop_dashboard.connections set synced_at = now(), sync_started_at = null, sync_error = null where user_id = ${userId}`
    })
    return { syncing: false }
  } catch (error) {
    const code = error instanceof WhoopError ? error.code : 'sync_failed'
    await db()`update whoop_dashboard.connections set sync_started_at = null, sync_error = ${code},
      needs_reconnect = ${code === 'reconnect_required'} where user_id = ${userId}`
    throw new WhoopError(code)
  }
}

export async function dashboardData(userId: string) {
  const connection = await getConnection(userId)
  if (!connection) throw new WhoopError('reconnect_required', 401)
  const records =
    await db()`select kind, data from whoop_dashboard.records where user_id = ${userId} order by start_at asc`
  return {
    user: {
      firstName: connection.first_name,
      lastName: connection.last_name,
      email: connection.email,
    },
    syncedAt: connection.synced_at?.toISOString() ?? null,
    syncing:
      !!connection.sync_started_at &&
      Date.now() - connection.sync_started_at.getTime() < 600_000,
    syncError: connection.sync_error,
    needsReconnect: connection.needs_reconnect,
    records,
  }
}
