# Connecting Ycode MCP to Claude Code (terminal)

## Prerequisites

- Ycode dev server must be running: `npm run dev` (port 3002)
- MCP token can be found in Ycode > Settings > MCP (or in Cursor's config)

## Step 1 — Get the MCP URL

The MCP URL follows this format:
```
http://localhost:3002/ycode/mcp/<TOKEN>
```

If Cursor is already connected, the token is in `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "ycode": {
      "url": "http://localhost:3002/ycode/mcp/ymc_XXXXX..."
    }
  }
}
```

## Step 2 — Add the server via CLI

The most reliable method is to use the `claude mcp add` command:

```bash
claude mcp add --transport http ycode "http://localhost:3002/ycode/mcp/ymc_XXXXX..."
```

This automatically writes to `.claude/settings.local.json` and `.claude/mcp.json`.

### Manual alternative

Create `.claude/mcp.json` at the project root:
```json
{
  "mcpServers": {
    "ycode": {
      "url": "http://localhost:3002/ycode/mcp/ymc_XXXXX..."
    }
  }
}
```

And make sure `.claude/settings.local.json` contains:
```json
{
  "enabledMcpjsonServers": ["ycode"]
}
```

**Both files are required** — `mcp.json` defines the server, `settings.local.json` enables it.

## Step 3 — Restart Claude Code

MCP servers are only loaded at startup. Quit (`/exit` or Ctrl+C) and relaunch `claude`.

## Verification

Type `/mcp` in Claude Code — the "ycode" server should appear as connected.

## Troubleshooting

| Problem | Solution |
|---|---|
| ycode not listed in `/mcp` | Make sure `npm run dev` is running + restart Claude Code |
| Connection error | Check port 3002 is reachable: `curl http://localhost:3002` |
| Invalid token | Regenerate the token in Ycode Settings > MCP |
| `mcp.json` alone isn't enough | Add `"enabledMcpjsonServers": ["ycode"]` to `settings.local.json` |

## Files involved

```
.claude/
  mcp.json                 # MCP server definition (URL + token)
  settings.local.json      # Enables the server (enabledMcpjsonServers)
```

## Note

`.claude/mcp.json` contains a token — it is listed in `.gitignore` to prevent committing it.
