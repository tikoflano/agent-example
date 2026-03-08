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

### MCP tool bridge

`@mastra/mcp`'s `listTools()` returns tools with zod v3 schemas that are incompatible with AI SDK v5 (zod v4). The agent uses a custom bridge (`packages/agent/src/mcp-bridge.ts`) that:
1. Connects to the MCP server using `@modelcontextprotocol/sdk` client via SSE
2. Lists tools and wraps their JSON Schema definitions as AI SDK v5 `dynamicTool()` objects
3. Each tool's `execute` function calls back to the MCP server via the SDK client

This bridge is transparent — add tools to the MCP server and they appear in the agent automatically on restart.

### Known caveats

- **Docker**: This environment runs Docker-in-Docker. Requires `fuse-overlayfs` storage driver and `iptables-legacy`. See the `Dockerfile.dev` and `docker-compose.yml`.
- **llama3.2 3B**: The small model sometimes makes multiple tool call attempts before succeeding (it may pass string args where numbers are expected). This is a model limitation, not a code bug. Larger models (e.g. `llama3.1:8b`) handle tool calling more reliably.

### Model swapping

Change the Ollama model via `OLLAMA_MODEL` env var (default: `llama3.2`). The model must be pulled in the Ollama container first.
