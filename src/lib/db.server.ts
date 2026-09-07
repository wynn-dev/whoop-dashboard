import '@tanstack/react-start/server-only'
import postgres from 'postgres'
import { env } from './env.server'

const globals = globalThis as typeof globalThis & {
  whoopSql?: ReturnType<typeof postgres>
}

export function db() {
  return (globals.whoopSql ??= postgres(env().DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  }))
}

export interface ConnectionRow {
  user_id: string
  email: string
  first_name: string
  last_name: string
  access_token: string
  refresh_token: string
  expires_at: Date
  scopes: string
  synced_at: Date | null
  sync_started_at: Date | null
  sync_error: string | null
  needs_reconnect: boolean
}

export async function getConnection(userId: string) {
  const [connection] = await db()<
    ConnectionRow[]
  >`select * from whoop_dashboard.connections where user_id = ${userId}`
  return connection
}
