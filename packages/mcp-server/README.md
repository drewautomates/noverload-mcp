# noverload-mcp

Connect your Noverload saved content to AI assistants like Claude, Cursor, and Windsurf using the Model Context Protocol (MCP).

## 🚀 Version 0.4.0 - SDK Update!

### What's New
- **Updated MCP SDK**: Upgraded to latest version 1.17.4 for improved compatibility and performance
- **Enhanced Stability**: Updated all dependencies to latest stable versions

### Key Features
- **Advanced Search Filters**: Filter by content type, date range, tags, and exclude domains
- **Full Content Retrieval**: Get complete article/transcript text with token warnings
- **Token Estimation**: Preview token usage and costs before expensive operations
- **Content Synthesis**: Analyze multiple sources for patterns and contradictions
- **Semantic Similarity**: Find related content based on meaning
- **Batch Operations**: Efficiently fetch multiple items at once
- **Concept Expansion**: Optional semantic search for broader results

## Features

- 📚 Access all your saved content (YouTube, X posts, Reddit, articles, PDFs)
- 🔍 Advanced search with filters and full content
- 🧮 Token usage estimation and cost calculation
- 🔗 Cross-content synthesis and pattern detection
- 🎯 Semantic similarity search
- ✅ View and complete action items
- 🎯 Reference your Health, Wealth, and Relationships goals
- 🔒 Secure access with personal access tokens
- 📝 Read-only mode by default for safety

## Installation

```bash
npm install -g noverload-mcp
```

## Quick Start

### 1. Get Your Access Token

1. Log in to [Noverload](https://noverload.com)
2. Go to Settings → Apps
3. Click "New Token" and create a personal access token
4. Copy the token (you won't be able to see it again)

### 2. Configure Your AI Tool

#### Claude Desktop

Add to your Claude configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "noverload": {
      "command": "npx",
      "args": ["-y", "noverload-mcp"],
      "env": {
        "NOVERLOAD_CONFIG": "{\"accessToken\":\"YOUR_TOKEN_HERE\",\"readOnly\":true}"
      }
    }
  }
}
```

#### Cursor

1. Open Cursor Settings
2. Navigate to Features → Model Context Protocol
3. Add the same configuration as above

#### Windsurf

Add to your Windsurf MCP configuration with the same format as Claude Desktop.

## Available Commands

Once configured, your AI assistant can use these tools:

### Core Tools
- **list_saved_content** - Browse your saved content library with filters
- **get_content_details** - Get full details including transcript/article text
- **save_content** - Save new URLs (when read-only is disabled)

### Enhanced Search (v0.2.0)
- **search_content** - Advanced search with:
  - Content type filtering (YouTube, Reddit, articles, PDFs)
  - Date range filtering
  - Tag-based filtering
  - Domain exclusion
  - Optional full content retrieval
  - Concept expansion for broader results

### Analysis Tools (v0.2.0)
- **estimate_search_tokens** - Preview token usage and costs before searching
- **synthesize_content** - Find patterns, connections, and contradictions across sources
- **find_similar_content** - Discover related content using semantic similarity
- **batch_get_content** - Efficiently fetch multiple items at once

### Task Management
- **list_actions** - View action items extracted from content
- **complete_action** - Mark actions as done (when read-only is disabled)
- **list_goals** - See your Health, Wealth, and Relationships goals

## Configuration Options

| Option        | Type    | Default                     | Description                          |
| ------------- | ------- | --------------------------- | ------------------------------------ |
| `accessToken` | string  | required                    | Your Noverload personal access token |
| `apiUrl`      | string  | `https://noverload.com` | API endpoint (for self-hosting)      |
| `readOnly`    | boolean | `true`                      | Restrict to read-only operations     |

## Security

- **Use Read-Only Mode**: Keep `readOnly: true` unless you need write access
- **Protect Your Token**: Never share your personal access token
- **Revoke When Needed**: You can revoke tokens anytime from Noverload settings

## Support

- [Documentation](https://noverload.com/docs)
- [GitHub Issues](https://github.com/noverload/mcp-server/issues)
- Email: contact@noverload.com

## License

MIT © Noverload
