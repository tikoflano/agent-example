import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { PORTS } from '@agent-example/shared'
import type { ChatRequest, ChatResponse } from '@agent-example/shared'

const agentUrl = process.env.AGENT_URL || `http://localhost:${PORTS.AGENT}`

const app = new Hono()
app.use('/*', cors())

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'api-gateway' })
})

app.post('/api/chat', async (c) => {
  const body = await c.req.json<ChatRequest>()

  try {
    const response = await fetch(`${agentUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      return c.json(error, response.status as 400)
    }

    const data = (await response.json()) as ChatResponse
    return c.json(data)
  } catch (error) {
    console.error('[API] Error forwarding to agent:', error)
    return c.json({ error: 'Agent service unavailable' }, 503)
  }
})

const port = PORTS.API
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[API] Gateway running at http://localhost:${info.port}`)
  console.log(`[API] Agent upstream: ${agentUrl}`)
})
