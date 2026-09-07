import { db } from '../src/lib/db.server'

try {
  const sql = db()
  await sql`select 1`
  const [status] =
    await sql`select to_regclass('whoop_dashboard.connections') is not null as ready`
  console.log(
    `PostgreSQL connection: OK. Dashboard schema: ${status.ready ? 'ready' : 'migration required'}.`,
  )
} catch (error) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'configuration_or_connection_error'
  console.error(
    `Database check failed (${code}). Connection details have been omitted.`,
  )
  process.exitCode = 1
} finally {
  await db().end()
}
