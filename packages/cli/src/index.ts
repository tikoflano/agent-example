import * as readline from 'node:readline'
import { PORTS } from '@agent-example/shared'
import type { ChatMessage } from '@agent-example/shared'

const apiUrl = process.env.API_URL || `http://localhost:${PORTS.API}`
const messages: ChatMessage[] = []

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt() {
  rl.question('\nYou: ', async (input) => {
    const text = input.trim()
    if (!text) return prompt()

    if (text === '/quit' || text === '/exit') {
      console.log('Goodbye!')
      rl.close()
      process.exit(0)
    }

    if (text === '/clear') {
      messages.length = 0
      console.log('Conversation cleared.')
      return prompt()
    }

    messages.push({ role: 'user', content: text })

    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error(`\nError: ${(err as { error: string }).error || res.statusText}`)
        messages.pop()
        return prompt()
      }

      const data = (await res.json()) as { message: ChatMessage }
      messages.push(data.message)
      console.log(`\nAgent: ${data.message.content}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`\nError: ${msg}`)
      console.error('Is the API server running?')
      messages.pop()
    }

    prompt()
  })
}

console.log('=== Agent Example CLI ===')
console.log(`Connecting to: ${apiUrl}`)
console.log('Commands: /clear (reset), /quit (exit)\n')
prompt()
