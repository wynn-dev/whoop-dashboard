import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createFormServer, type McpDataSource } from '../src/lib/mcp'
import { demoDashboard } from '../src/lib/demo'
import type { DashboardData } from '../src/lib/whoop'

vi.mock('../src/lib/db.server', () => ({
  db: () => () => Promise.resolve([]),
  getConnection: vi.fn(),
}))

async function connect(source: McpDataSource) {
  const server = createFormServer(source)
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}
const demoSource = (
  overrides: Partial<DashboardData> = {},
  sync = vi.fn(async () => ({ syncing: true })),
): McpDataSource & { sync: typeof sync } => ({
  load: async () => ({ ...demoDashboard(), ...overrides }),
  sync,
})
type Structured = Record<string, any>
const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) => {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: unknown
    structuredContent?: unknown
    isError?: boolean
  }
  return {
    ...result,
    data: result.structuredContent as Structured,
    text: (result.content as { text: string }[])[0]?.text ?? '',
  }
}

describe('FORM MCP server over an in-memory transport', () => {
  it('exposes a small, annotated tool surface', async () => {
    const client = await connect(demoSource())
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_day',
      'get_insights',
      'get_status',
      'get_trends',
      'get_workout',
      'list_days',
      'list_workouts',
      'sync_now',
    ])
    for (const tool of tools) {
      expect(tool.description!.length).toBeGreaterThan(40)
      expect(tool.outputSchema).toBeDefined()
      expect(tool.annotations?.readOnlyHint).toBe(tool.name !== 'sync_now')
    }
    const { resources } = await client.listResources()
    expect(resources.map((r) => r.uri)).toEqual(['whoop://status'])
    const { resourceTemplates } = await client.listResourceTemplates()
    expect(resourceTemplates[0].uriTemplate).toBe('whoop://days/{date}')
    const { prompts } = await client.listPrompts()
    expect(prompts.map((p) => p.name)).toEqual(['weekly_review'])
  })

  it('reports status and a full day with compact, rounded numbers', async () => {
    const client = await connect(demoSource())
    const status = await call(client, 'get_status')
    expect(status.isError).toBeFalsy()
    expect(status.data.dataSpan.days).toBe(90)
    expect(status.data.latest.recovery).toBe(86)
    expect(status.data.latest.recoveryZone).toBe('high')

    const day = await call(client, 'get_day')
    expect(day.data.day.date).toBe(status.data.latest.date)
    expect(day.data.day.sleep.hours).toBe(7.7)
    expect(day.data.day.sleep.wake).toBe('7:00 AM')
    expect(day.data.workouts).toHaveLength(1)
    expect(day.data.health).toHaveLength(5)
    expect(day.data.nextDate).toBeNull()
    expect(day.text.length).toBeLessThan(2000)

    const lean = await call(client, 'get_day', {
      date: day.data.previousDate,
      include: [],
    })
    expect(lean.data.workouts).toBeUndefined()
    expect(lean.data.health).toBeUndefined()

    const missing = await call(client, 'get_day', { date: '2020-01-01' })
    expect(missing.isError).toBe(true)
    expect(missing.text).toMatch(/Available/)
  })

  it('lists days with only the requested fields and caps rows', async () => {
    const client = await connect(demoSource())
    const table = await call(client, 'list_days', {
      days: 7,
      fields: ['recovery', 'bedtime'],
    })
    expect(table.data.count).toBe(7)
    expect(Object.keys(table.data.rows[0])).toEqual([
      'date',
      'recovery',
      'bedtime',
    ])
    expect(table.text.length).toBeLessThan(700)
    const big = await call(client, 'list_days', { days: 90 })
    expect(big.data.count).toBe(90)
    const tooMany = await call(client, 'list_days', { days: 91 })
    expect(tooMany.isError).toBe(true)
    expect(tooMany.text).toMatch(/<=90/)
  })

  it('paginates and filters workouts and details one of them', async () => {
    const client = await connect(demoSource())
    const first = await call(client, 'list_workouts', { limit: 5 })
    expect(first.data.count).toBe(5)
    expect(first.data.nextCursor).toBe('5')
    const second = await call(client, 'list_workouts', {
      limit: 5,
      cursor: '5',
    })
    expect(second.data.rows[0].id).not.toBe(first.data.rows[0].id)
    const cycling = await call(client, 'list_workouts', {
      sport: 'CYCL',
      days: 90,
    })
    expect(cycling.data.total).toBeGreaterThan(0)
    expect(
      cycling.data.rows.every((row: Structured) => row.sport === 'cycling'),
    ).toBe(true)

    const detail = await call(client, 'get_workout', {
      id: first.data.rows[0].id,
    })
    expect(detail.data.zonesMin).toHaveLength(6)
    expect(detail.data.workout.durationMin).toBeGreaterThan(0)
    expect(detail.data.percentRecorded).toBe(99.6)
    const nope = await call(client, 'get_workout', { id: 'nope' })
    expect(nope.isError).toBe(true)
  })

  it('summarises trends and returns only the insight topics requested', async () => {
    const client = await connect(demoSource())
    const trends = await call(client, 'get_trends', { range: 30 })
    expect(trends.data.window.days).toBe(30)
    expect(typeof trends.data.averages.recovery).toBe('number')
    expect(trends.data.weekInReview.strain.days).toEqual([7, 7])
    // One demo day has a pending recovery, and pending is never zero.
    expect(trends.data.weekInReview.recovery.days).toEqual([6, 7])
    expect(trends.data.trainingLoad.label).toMatch(
      /Steady|Ramping up|Backing off/,
    )
    expect(trends.data.weekdays.recovery).toHaveLength(7)

    const some = await call(client, 'get_insights', {
      topics: ['unusual_nights', 'hrv_readiness'],
    })
    expect(Object.keys(some.data.topics)).toEqual([
      'unusual_nights',
      'hrv_readiness',
    ])
    expect(some.data.topics.unusual_nights.nights).toHaveLength(1)
    expect(some.data.topics.hrv_readiness.ready).toBe(true)
    expect(some.text.length).toBeLessThan(1500)

    const all = await call(client, 'get_insights', { range: 90 })
    expect(Object.keys(all.data.topics)).toHaveLength(17)
    expect(all.data.caveat).toMatch(/Not a diagnosis/)
    expect(all.data.topics.hard_days.ready).toBeDefined()
  })

  it('starts a sync only when it can, and explains when it cannot', async () => {
    const ready = demoSource()
    const client = await connect(ready)
    const started = await call(client, 'sync_now')
    expect(started.data).toEqual({
      started: true,
      syncing: true,
      note: 'Sync started; poll get_status.',
    })
    expect(ready.sync).toHaveBeenCalledTimes(1)

    const busy = await connect(demoSource({ syncing: true }))
    expect((await call(busy, 'sync_now')).data.started).toBe(false)

    const limited = await connect(
      demoSource(
        {},
        vi.fn(async () => {
          throw new Error('rate_limited')
        }),
      ),
    )
    const limitedResult = await call(limited, 'sync_now')
    expect(limitedResult.isError).toBe(true)
    expect(limitedResult.text).toMatch(/rate limit/)

    const nobody = await connect({
      load: async () => null,
      sync: async () => ({ syncing: false }),
    })
    expect((await call(nobody, 'get_status')).isError).toBe(true)
    expect((await call(nobody, 'sync_now')).isError).toBe(true)
  })

  it('serves resources and the weekly review prompt', async () => {
    const client = await connect(demoSource())
    const status = await client.readResource({ uri: 'whoop://status' })
    expect(
      JSON.parse((status.contents[0] as { text: string }).text).dataSpan.days,
    ).toBe(90)
    const latest = (await call(client, 'get_status')).data.latest.date as string
    const day = await client.readResource({ uri: `whoop://days/${latest}` })
    expect(
      JSON.parse((day.contents[0] as { text: string }).text).recovery,
    ).toBe(86)
    const prompt = await client.getPrompt({
      name: 'weekly_review',
      arguments: {},
    })
    expect((prompt.messages[0].content as { text: string }).text).toMatch(
      /get_trends/,
    )
  })
})

describe('/api/mcp bearer authentication', () => {
  const token = 'a'.repeat(48)
  beforeEach(() => {
    Object.assign(process.env, {
      WHOOP_CLIENT_ID: 'client',
      WHOOP_CLIENT_SECRET: 'secret',
      WHOOP_ALLOWED_EMAIL: 'owner@example.com',
      APP_URL: 'http://localhost:3001',
      WHOOP_REDIRECT_URI: 'http://localhost:3001/api/auth/whoop/callback',
      WHOOP_SCOPES:
        'read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout offline',
      SESSION_SECRET: 'x'.repeat(48),
      TOKEN_ENCRYPTION_KEY: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      MCP_BEARER_TOKEN: token,
    })
  })
  afterEach(() => {
    delete process.env.MCP_BEARER_TOKEN
  })
  const post = async (body: unknown, authorization?: string) => {
    const { Route } = await import('../src/routes/api.mcp')
    const handler = (Route.options as any).server.handlers.POST as (ctx: {
      request: Request
    }) => Promise<Response>
    return handler({
      request: new Request('http://localhost:3001/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify(body),
      }),
    })
  }
  const initialize = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    },
  }

  it('refuses missing, malformed, and wrong tokens with a challenge', async () => {
    for (const header of [
      undefined,
      'Bearer nope',
      `Basic ${token}`,
      `Bearer ${token}x`,
    ]) {
      const response = await post(initialize, header)
      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toMatch(/Bearer/)
      expect(response.headers.get('cache-control')).toBe('no-store')
    }
  })

  it('refuses everything when no token is configured', async () => {
    delete process.env.MCP_BEARER_TOKEN
    const response = await post(initialize, `Bearer ${token}`)
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe('mcp_not_configured')
  })

  it('completes an initialize handshake with the right token', async () => {
    const response = await post(initialize, `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json()
    expect(body.result.serverInfo.name).toBe('form-whoop')
    expect(body.result.instructions).toMatch(/physiological day/)
    const tools = await post(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      `Bearer ${token}`,
    )
    expect(tools.status).toBe(200)
    expect((await tools.json()).result.tools).toHaveLength(8)
  })
})
