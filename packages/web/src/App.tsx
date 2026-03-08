import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '@agent-example/shared'

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Request failed')
      }

      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Agent Example</h1>
        <span style={styles.badge}>Local LLM + MCP</span>
      </header>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            Send a message to start chatting with your local agent.
            <br />
            <span style={styles.hint}>
              Try: &quot;What time is it?&quot; or &quot;Calculate 42 * 17&quot;
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
            }}
          >
            <div style={styles.messageRole}>{msg.role === 'user' ? 'You' : 'Agent'}</div>
            <div style={styles.messageContent}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.message, ...styles.assistantMessage }}>
            <div style={styles.messageRole}>Agent</div>
            <div style={styles.thinking}>Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          style={styles.input}
        />
        <button type="submit" disabled={loading || !input.trim()} style={styles.button}>
          Send
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  title: { fontSize: 20, fontWeight: 600 },
  badge: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 12,
    background: '#1a3a2a',
    color: '#4ade80',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#666',
    marginTop: 80,
    lineHeight: 1.6,
  },
  hint: { fontSize: 13, color: '#555' },
  message: { padding: '10px 14px', borderRadius: 10, maxWidth: '85%' },
  userMessage: {
    alignSelf: 'flex-end',
    background: '#1e3a5f',
    color: '#c0d8f0',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    background: '#1e1e1e',
    color: '#d0d0d0',
  },
  messageRole: { fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.6 },
  messageContent: { fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  thinking: { fontSize: 14, opacity: 0.5, fontStyle: 'italic' },
  form: {
    display: 'flex',
    gap: 8,
    padding: '12px 0',
    borderTop: '1px solid #2a2a2a',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#1a1a1a',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
}
