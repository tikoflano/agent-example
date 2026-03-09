import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { dynamicTool, jsonSchema } from 'ai'
import type { ToolSet } from 'ai'

export interface McpBridge {
  tools: ToolSet
  disconnect: () => Promise<void>
}

export async function createMcpBridge(mcpServerUrl: string): Promise<McpBridge> {
  const transport = new SSEClientTransport(new URL(`${mcpServerUrl}/sse`))
  const client = new Client({ name: 'agent-mcp-bridge', version: '1.0.0' }, { capabilities: {} })

  await client.connect(transport)

  const { tools: mcpTools } = await client.listTools()
  const tools: ToolSet = {}

  for (const mcpTool of mcpTools) {
    tools[mcpTool.name] = dynamicTool({
      description: mcpTool.description || mcpTool.name,
      inputSchema: jsonSchema(mcpTool.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (args) => {
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: args as Record<string, unknown>,
        })
        const textParts = (result.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text!)
        return textParts.join('\n')
      },
    })
  }

  return {
    tools,
    disconnect: () => client.close(),
  }
}
