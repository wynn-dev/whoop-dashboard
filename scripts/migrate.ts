import { readFile } from 'node:fs/promises'
import { db } from '../src/lib/db.server'

try {
  const migration = await readFile(
    new URL('../migrations/001_initial.sql', import.meta.url),
    'utf8',
  )
  await db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(61420731)`
    await sql.unsafe(migration)
    await sql`insert into whoop_dashboard.migrations (name) values ('001_initial') on conflict do nothing`
  })
  console.log('Migration applied: whoop_dashboard schema and tables are ready.')
} catch (error) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'configuration_or_connection_error'
  console.error(
    `Migration failed (${code}). Rolled back; connection details have been omitted.`,
  )
  process.exitCode = 1
} finally {
  await db().end()
}
