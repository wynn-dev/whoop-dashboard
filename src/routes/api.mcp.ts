import { createFileRoute } from '@tanstack/react-router'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createFormServer } from '@/lib/mcp'
import { authorizeMcp, mcpDataSource } from '@/lib/mcp.server'

// Stateless Streamable HTTP: every request gets a fresh server and transport,
// nothing is kept between calls, and plain JSON responses are used instead of
// SSE. That keeps the endpoint safe behind any proxy and trivial to scale.
async function handle(request: Request) {
  const denied = authorizeMcp(request)
  if (denied) return denied
  const server = createFormServer(mcpDataSource())
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    const response = await transport.handleRequest(request)
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: response.status, headers })
  } finally {
    // Close after the JSON body is ready. Nothing streams in this mode.
    queueMicrotask(() => {
      void transport.close()
      void server.close()
    })
  }
}

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
    },
  },
})
