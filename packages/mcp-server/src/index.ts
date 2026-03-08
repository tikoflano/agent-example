import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import express from 'express'
import { z } from 'zod'
import { PORTS } from '@agent-example/shared'

const server = new McpServer({
  name: 'agent-example-mcp',
  version: '0.0.1',
})

server.tool(
  'calculator',
  'Perform basic arithmetic operations',
  {
    operation: z
      .enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('The arithmetic operation'),
    a: z.number().describe('First operand'),
    b: z.number().describe('Second operand'),
  },
  async ({ operation, a, b }) => {
    let result: number
    switch (operation) {
      case 'add':
        result = a + b
        break
      case 'subtract':
        result = a - b
        break
      case 'multiply':
        result = a * b
        break
      case 'divide':
        if (b === 0) return { content: [{ type: 'text', text: 'Error: Division by zero' }] }
        result = a / b
        break
    }
    return { content: [{ type: 'text', text: `${a} ${operation} ${b} = ${result}` }] }
  },
)

server.tool('datetime', 'Get the current date and time', {}, async () => {
  const now = new Date()
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          iso: now.toISOString(),
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          timestamp: now.getTime(),
        }),
      },
    ],
  }
})

server.tool(
  'random_number',
  'Generate a random number within a range',
  {
    min: z.number().describe('Minimum value (inclusive)'),
    max: z.number().describe('Maximum value (inclusive)'),
  },
  async ({ min, max }) => {
    const result = Math.floor(Math.random() * (max - min + 1)) + min
    return {
      content: [{ type: 'text', text: `Random number between ${min} and ${max}: ${result}` }],
    }
  },
)

const app = express()
const transports = new Map<string, SSEServerTransport>()

app.get('/sse', async (_req, res) => {
  const transport = new SSEServerTransport('/message', res)
  const sessionId = transport.sessionId
  transports.set(sessionId, transport)
  console.log(`[MCP] Client connected: ${sessionId}`)

  res.on('close', () => {
    transports.delete(sessionId)
    console.log(`[MCP] Client disconnected: ${sessionId}`)
  })

  await server.connect(transport)
})

app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId as string
  const transport = transports.get(sessionId)
  if (!transport) {
    res.status(400).json({ error: 'Unknown session' })
    return
  }
  await transport.handlePostMessage(req, res)
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', tools: ['calculator', 'datetime', 'random_number'] })
})

const port = PORTS.MCP_SERVER
app.listen(port, () => {
  console.log(`[MCP] Server running at http://localhost:${port}`)
  console.log(`[MCP] SSE endpoint: http://localhost:${port}/sse`)
})
