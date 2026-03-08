# AGENTS.md

## Cursor Cloud specific instructions

This is a TypeScript monorepo for learning how to build a local AI agent with Docker. It uses pnpm workspaces.

### Architecture

| Package | Tech | Port | Role |
|---|---|---|---|
| `packages/shared` | TS | — | Shared types and constants |
| `packages/web` | Vite + React | 5173 | Browser chat UI |
| `packages/cli` | TS + tsx | — | Terminal chat client |
| `packages/api` | Hono | 3000 | HTTP API gateway |
| `packages/agent` | Mastra + Hono | 3001 | Agent logic, Ollama integration |
| `packages/mcp-server` | MCP SDK + Express | 3002 | MCP tools via SSE |

### Running services

Start order matters: Ollama first, then mcp-server, agent, api, web.

```
docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama ollama/ollama
docker exec ollama ollama pull llama3.2
pnpm dev:mcp-server   # port 3002
pnpm dev:agent        # port 3001
pnpm dev:api          # port 3000
pnpm dev:web          # port 5173
```

Or use `docker compose up` to run everything in containers (requires Docker).

### Lint / Format / Type-check

```
pnpm lint          # ESLint (flat config)
pnpm format:check  # Prettier
npx tsc --noEmit -p packages/<pkg>/tsconfig.json   # per-package type check
```

### Known issues

- **MCP tool calling**: Mastra v1.10 + `@ai-sdk/openai-compatible` + Ollama does not properly execute MCP tools. Tool descriptions get injected into the system prompt but actual structured tool calling doesn't trigger. The agent starts with `ENABLE_MCP_TOOLS=false` by default. This is a Mastra/AI SDK v5 interop issue to iterate on.
- **Docker**: This environment runs Docker-in-Docker. Requires `fuse-overlayfs` storage driver and `iptables-legacy`. See the `Dockerfile.dev` and `docker-compose.yml`.

### Model swapping

Change the Ollama model via `OLLAMA_MODEL` env var (default: `llama3.2`). The model must be pulled in the Ollama container first.
