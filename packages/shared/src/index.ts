export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
}

export interface ChatResponse {
  message: ChatMessage
}

export const PORTS = {
  WEB: 5173,
  API: 3000,
  AGENT: 3001,
  MCP_SERVER: 3002,
  OLLAMA: 11434,
} as const

export const DEFAULT_MODEL = 'llama3.2'
