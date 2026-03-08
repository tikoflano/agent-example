import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { Agent } from '@mastra/core/agent'
import { MCPClient } from '@mastra/mcp'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { PORTS, DEFAULT_MODEL } from '@agent-example/shared'
import type { ChatRequest } from '@agent-example/shared'

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || `http://localhost:${PORTS.OLLAMA}`
const ollamaModel = process.env.OLLAMA_MODEL || DEFAULT_MODEL
const mcpServerUrl = process.env.MCP_SERVER_URL || `http://localhost:${PORTS.MCP_SERVER}`
const enableMcpTools = process.env.ENABLE_MCP_TOOLS === 'true'

const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: `${ollamaBaseUrl}/v1`,
  apiKey: 'ollama',
})

let mcpClient: MCPClient | null = null

if (enableMcpTools) {
  mcpClient = new MCPClient({
    id: 'agent-mcp-client',
    servers: {
      tools: {
        url: new URL(`${mcpServerUrl}/sse`),
      },
    },
  })
}

let agent: Agent

async function initAgent() {
  let tools = {}

  if (mcpClient) {
    try {
      tools = await mcpClient.listTools()
      console.log(`[Agent] Loaded ${Object.keys(tools).length} MCP tools:`, Object.keys(tools))
    } catch (error) {
      console.warn('[Agent] Could not load MCP tools:', error)
    }
  }

  agent = new Agent({
    id: 'local-agent',
    name: 'Local Agent',
    instructions:
      'You are a helpful local AI assistant. Be concise, friendly, and provide direct answers.',
    model: ollama.chatModel(ollamaModel),
    ...(Object.keys(tools).length > 0 ? { tools } : {}),
  })

  console.log(`[Agent] Initialized with model: ${ollamaModel}`)
  if (!enableMcpTools) {
    console.log(`[Agent] MCP tools disabled (set ENABLE_MCP_TOOLS=true to enable)`)
  }
}

const app = new Hono()
app.use('/*', cors())

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    model: ollamaModel,
    ollamaUrl: ollamaBaseUrl,
    mcpUrl: mcpServerUrl,
    mcpToolsEnabled: enableMcpTools,
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
