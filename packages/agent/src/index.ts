import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { Agent } from '@mastra/core/agent'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { PORTS, DEFAULT_MODEL } from '@agent-example/shared'
import type { ChatRequest } from '@agent-example/shared'
import { createMcpBridge } from './mcp-bridge.js'
import type { McpBridge } from './mcp-bridge.js'

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || `http://localhost:${PORTS.OLLAMA}`
const ollamaModel = process.env.OLLAMA_MODEL || DEFAULT_MODEL
const mcpServerUrl = process.env.MCP_SERVER_URL || `http://localhost:${PORTS.MCP_SERVER}`

const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: `${ollamaBaseUrl}/v1`,
  apiKey: 'ollama',
})

let agent: Agent
let mcpBridge: McpBridge | null = null

async function initAgent() {
  try {
    mcpBridge = await createMcpBridge(mcpServerUrl)
    const toolNames = Object.keys(mcpBridge.tools)
    console.log(`[Agent] Loaded ${toolNames.length} MCP tools via bridge:`, toolNames)
  } catch (error) {
    console.warn('[Agent] Could not connect to MCP server:', error)
  }

  const tools = mcpBridge?.tools ?? {}

  agent = new Agent({
    id: 'local-agent',
    name: 'Local Agent',
    instructions: [
      'You are a helpful local AI assistant.',
      Object.keys(tools).length > 0
        ? 'You have access to tools. Use them when the user asks for calculations, the current time, or random numbers. Always use tools when they are relevant — do not make up answers for questions tools can answer.'
        : '',
      'Be concise and helpful.',
    ]
      .filter(Boolean)
      .join(' '),
    model: ollama.chatModel(ollamaModel),
    ...(Object.keys(tools).length > 0 ? { tools } : {}),
  })

  console.log(`[Agent] Initialized with model: ${ollamaModel}`)
}

const app = new Hono()
app.use('/*', cors())

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    model: ollamaModel,
    ollamaUrl: ollamaBaseUrl,
    mcpUrl: mcpServerUrl,
    tools: mcpBridge ? Object.keys(mcpBridge.tools) : [],
  })
})

app.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>()

  if (!body.messages || body.messages.length === 0) {
    return c.json({ error: 'Messages array is required' }, 400)
  }

  try {
    const response = await agent.generate(
      body.messages.map((m) => ({ role: m.role, content: m.content })) as Parameters<
        typeof agent.generate
      >[0],
    )
    return c.json({
      message: {
        role: 'assistant' as const,
        content: response.text,
      },
    })
  } catch (error) {
    console.error('[Agent] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

async function main() {
  await initAgent()
  const port = PORTS.AGENT
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[Agent] Server running at http://localhost:${info.port}`)
  })
}

main()
