import '@tanstack/react-start/server-only'
import {
  getCookie,
  setCookie,
  deleteCookie,
} from '@tanstack/react-start/server'
import { sealData, unsealData } from 'iron-session'
import { db } from './db.server'
import { env } from './env.server'
import { hashToken, randomToken } from './crypto.server'
import { normalizeEmail } from './allowlist'

const SESSION_COOKIE = 'form-session'
const OAUTH_COOKIE = 'form-oauth'
const SESSION_TTL = 60 * 60 * 24 * 30

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: new URL(env().APP_URL).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function createOAuthState() {
  const state = randomToken()
  setCookie(
    OAUTH_COOKIE,
    await sealData({ state }, { password: env().SESSION_SECRET, ttl: 600 }),
    cookieOptions(600),
  )
  return state
}

export async function consumeOAuthState() {
  const cookie = getCookie(OAUTH_COOKIE)
  deleteCookie(OAUTH_COOKIE, cookieOptions(0))
  if (!cookie) return null
  const data = await unsealData<{ state?: string }>(cookie, {
    password: env().SESSION_SECRET,
    ttl: 600,
  })
  return data.state ?? null
}

export async function createSession(userId: string) {
  await destroySession()
  const token = randomToken()
  await db()`insert into whoop_dashboard.sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, ${new Date(Date.now() + SESSION_TTL * 1000)})`
  await db()`delete from whoop_dashboard.sessions where expires_at < now()`
  setCookie(
    SESSION_COOKIE,
    await sealData(
      { token },
      { password: env().SESSION_SECRET, ttl: SESSION_TTL },
    ),
    cookieOptions(SESSION_TTL),
  )
}

async function sessionToken() {
  const cookie = getCookie(SESSION_COOKIE)
  if (!cookie) return null
  const data = await unsealData<{ token?: string }>(cookie, {
    password: env().SESSION_SECRET,
    ttl: SESSION_TTL,
  })
  return data.token ?? null
}

export async function currentUserId() {
  const token = await sessionToken()
  if (!token) return null
  const [session] = await db()`select s.user_id from whoop_dashboard.sessions s
    join whoop_dashboard.connections c on c.user_id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
      and lower(trim(c.email)) = ${normalizeEmail(env().WHOOP_ALLOWED_EMAIL)}`
  return session ? String(session.user_id) : null
}

export async function destroySession() {
  const token = await sessionToken()
  if (token)
    await db()`delete from whoop_dashboard.sessions where token_hash = ${hashToken(token)}`
  deleteCookie(SESSION_COOKIE, cookieOptions(0))
}

export function validOrigin(request: Request) {
  return request.headers.get('origin') === new URL(env().APP_URL).origin
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
