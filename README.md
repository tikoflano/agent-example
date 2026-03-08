# agent-example

A full-stack TypeScript monorepo for building a local AI agent with Docker. Chat with a local LLM that can use MCP tools — calculator, date/time, random numbers, and image generation.

```
User  →  Web UI / CLI  →  API Gateway  →  Mastra Agent  →  Ollama (local LLM)
                                                │
                                                └──→  MCP Server (tools)
```

## Quick start

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

```bash
git clone https://github.com/tikoflano/agent-example.git
cd agent-example
docker compose up
```

That's it. On first run it will:
1. Build the Node.js containers and install dependencies
2. Start Ollama and pull the `llama3.2` model (~2GB download)
3. Start all services

Once you see all services healthy, open **http://localhost:5173** in your browser.

> First start takes 2-5 minutes (Docker build + model download). Subsequent starts are fast.

## Services

| Service | Port | Description |
|---|---|---|
| **Web UI** | [localhost:5173](http://localhost:5173) | React chat interface (Vite) |
| **API Gateway** | [localhost:3000](http://localhost:3000/health) | Hono HTTP gateway |
| **Agent** | [localhost:3001](http://localhost:3001/health) | Mastra agent + Ollama integration |
| **MCP Server** | [localhost:3002](http://localhost:3002/health) | MCP tools via SSE |
| **Ollama** | [localhost:11434](http://localhost:11434/api/tags) | Local LLM inference |

## What you can do

Talk to the agent in the web UI or CLI. It has access to these MCP tools:

- **Calculator** — "What is 123 * 456?"
- **Date/Time** — "What time is it?"
- **Random Number** — "Give me a random number between 1 and 100"
- **Image Generation** — "Generate an image of a sunset" (mock backend — swap in Stable Diffusion when you have a GPU)

## Configuration

Copy `.env.example` to `.env` to customize:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_MODEL` | `llama3.2` | Ollama model to use (auto-pulled on start) |

To use a different model:

```bash
OLLAMA_MODEL=mistral docker compose up
```

## Development (without Docker)

If you prefer running services directly on your machine:

```bash
# Install dependencies
pnpm install

# Start Ollama (install from https://ollama.com)
ollama pull llama3.2

# Start services (each in a separate terminal)
pnpm dev:mcp-server   # port 3002
pnpm dev:agent        # port 3001
pnpm dev:api          # port 3000
pnpm dev:web          # port 5173
```

All services use `tsx watch` for hot reloading — edit any file and it restarts automatically.

### CLI client

```bash
pnpm dev:cli
```

### Linting & formatting

```bash
pnpm lint          # ESLint
pnpm format:check  # Prettier
pnpm format        # Auto-fix formatting
```

## Architecture

```
packages/
├── shared/        # Shared TypeScript types and constants
├── web/           # Vite + React chat UI
├── cli/           # Terminal chat client (readline)
├── api/           # Hono HTTP API gateway
├── agent/         # Mastra agent + MCP bridge
└── mcp-server/    # MCP tools (calculator, datetime, random, image gen)
```

### Tech stack

- **Runtime:** Node.js 22 + TypeScript
- **Monorepo:** pnpm workspaces
- **Agent:** [Mastra](https://mastra.ai) with [AI SDK](https://sdk.vercel.ai)
- **LLM:** [Ollama](https://ollama.com) via OpenAI-compatible API
- **Tools:** [Model Context Protocol](https://modelcontextprotocol.io) (MCP) over SSE
- **API:** [Hono](https://hono.dev)
- **Web:** [Vite](https://vite.dev) + [React](https://react.dev)
- **Orchestration:** Docker Compose

### MCP tool bridge

Mastra's built-in MCP client (`@mastra/mcp`) has a zod v3/v4 incompatibility with AI SDK v5. The agent uses a custom bridge (`packages/agent/src/mcp-bridge.ts`) that:

1. Connects to the MCP server via SSE using `@modelcontextprotocol/sdk`
2. Discovers tools dynamically
3. Wraps them as AI SDK v5 `dynamicTool()` objects

Add a tool to the MCP server → the agent picks it up automatically on restart.

### Image generation backends

The `generate_image` tool uses a swappable `ImageBackend` interface:

```typescript
interface ImageBackend {
  generate(prompt: string, options?: ImageOptions): Promise<GeneratedImage>
}
```

Currently ships with `MockImageBackend` (gradient SVGs with prompt text). To add real image generation, implement the interface with your preferred backend (Stable Diffusion, DALL-E, etc.) and swap it in `packages/mcp-server/src/index.ts`.

## License

MIT
