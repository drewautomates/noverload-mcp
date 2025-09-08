# Noverload MCP Server

Connect your Noverload saved content to AI assistants like Claude, Cursor, and Windsurf using the Model Context Protocol (MCP).

**🚀 Release v0.7.0** - Major expansion with 23 advanced tools for content analysis, framework extraction, narrative building, and knowledge synthesis.

**🚀 Powered by Noverload API v2** for advanced search, content synthesis, and intelligent token management.

## Quick Start

1. **Get your token**: [Generate a Personal Access Token](https://www.noverload.com/dashboard/settings) from your Noverload dashboard
2. **Copy the config**: Use the zero-install configuration below with your token
3. **Add to your AI tool**: Paste into Claude Desktop, Cursor, or Windsurf settings
4. **Start using**: Ask your AI about your saved content!

```json
{
  "mcpServers": {
    "noverload": {
      "command": "npx",
      "args": ["-y", "noverload-mcp@latest"],
      "env": {
        "NOVERLOAD_CONFIG": "{\"accessToken\":\"your-token-here\",\"apiUrl\":\"https://www.noverload.com\",\"readOnly\":true}"
      }
    }
  }
}
```

## Features

- 📚 Access all your saved content (YouTube, X posts, Reddit, articles, PDFs)
- 🔍 Advanced search with multiple modes (smart, semantic, fulltext)
- ⚠️ Token warnings for large content (prevents context overflow)
- ✅ View and complete action items
- 🎯 Goals tracking
- 🧠 Content synthesis and insights generation
- 🔒 Secure access with personal access tokens
- 📝 Read-only mode by default for safety

## Installation

### For Users

#### Recommended: Zero-Install with NPX
No installation needed! NPX automatically downloads and runs the latest version:
```json
{
  "command": "npx",
  "args": ["-y", "noverload-mcp@latest"]
}
```

#### Alternative: Global Install
For faster startup (but requires manual updates):
```bash
npm install -g noverload-mcp
```
Then use:
```json
{
  "command": "noverload-mcp",
  "args": []
}
```

### For Development

```bash
git clone https://github.com/drewautomates/noverload-mcp.git
cd noverload-mcp
npm install
npm run build
```

## Configuration

### Step 1: Get Your Personal Access Token

1. Log in to [Noverload](https://www.noverload.com)
2. Go to Settings → API Access
3. Click "Generate Personal Access Token"
4. Copy the token (you won't be able to see it again)

### Step 2: Configure Your AI Tool

#### Claude Desktop

Edit your Claude configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "noverload": {
      "command": "npx",
      "args": ["-y", "noverload-mcp@latest"],
      "env": {
        "NOVERLOAD_CONFIG": "{\"accessToken\":\"YOUR_ACCESS_TOKEN_HERE\",\"apiUrl\":\"https://www.noverload.com\",\"readOnly\":true}"
      }
    }
  }
}
```

#### Cursor

1. Open Cursor Settings
2. Navigate to Features → Model Context Protocol
3. Add configuration:

```json
{
  "noverload": {
    "command": "noverload-mcp",
    "args": [],
    "env": {
      "NOVERLOAD_CONFIG": "{\"accessToken\":\"YOUR_ACCESS_TOKEN_HERE\",\"apiUrl\":\"https://www.noverload.com\",\"readOnly\":true}"
    }
  }
}
```

#### Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "noverload": {
      "command": "npx",
      "args": ["-y", "noverload-mcp@latest"],
      "env": {
        "NOVERLOAD_CONFIG": "{\"accessToken\":\"YOUR_ACCESS_TOKEN_HERE\",\"apiUrl\":\"https://www.noverload.com\",\"readOnly\":true}"
      }
    }
  }
}
```

## Available Tools

**23 powerful tools** organized into categories for comprehensive content analysis:

### Content Retrieval & Access
- `list_saved_content` - Browse your saved content library with filtering
- `get_content_details` - Get full details including summaries and insights  
- `get_raw_content` - Access raw text content for processing
- `batch_get_content` - Efficiently retrieve multiple items at once

### Search & Discovery
- `search_content` - Advanced search with multiple modes and filters
- `find_similar_content` - Discover semantically similar content
- `expand_search` - Expand queries with related terms for broader discovery

### Analysis & Synthesis
- `synthesize_content` - Create comprehensive analysis from multiple sources
- `explore_topic` - Deep dive into topics across your content
- `find_connections` - Discover patterns and relationships between content
- `extract_insights` - Extract key takeaways and actionable insights
- `get_timeline` - Build chronological understanding of topics
- `build_knowledge_graph` - Visualize concept relationships
- `extract_frameworks` - Identify methodologies and structured approaches
- `find_examples` - Locate specific examples and case studies
- `build_narrative` - Create coherent stories from multiple sources

### Content Management
- `save_content` - Save new URLs to your library (write mode only)
- `smart_sections` - Organize content into intelligent sections

### Actions & Goals
- `list_actions` - View extracted action items with priorities
- `complete_action` - Mark action items as done (write mode only)  
- `list_goals` - Access your Health, Wealth, Relationships goals

### Utility & Planning
- `estimate_search_tokens` - Preview token usage before large operations
- `get_instructions` - Access user-specific guidance and context
- `plan_query` - Strategically plan complex multi-step analyses

## Security Recommendations

1. **Use Read-Only Mode**: Keep `readOnly: true` in your configuration unless you specifically need write access
2. **Protect Your Token**: Never share your personal access token
3. **Revoke When Needed**: You can revoke tokens anytime from Noverload settings
4. **Scope Appropriately**: Consider creating separate tokens for different use cases

## Self-Hosting

If you prefer to run your own instance:

### Option 1: Local Development Server

```bash
git clone https://github.com/yourusername/noverload-mcp.git
cd noverload-mcp
npm install
npm run build

# Run directly
node packages/mcp-server/dist/index.js '{"accessToken":"YOUR_TOKEN","readOnly":true}'
```

### Option 2: Deploy to Your Infrastructure

The MCP server can be deployed to any Node.js hosting platform:

1. **Vercel/Netlify Functions**: Deploy as a serverless function
2. **Docker Container**: Package and run anywhere
3. **VPS**: Run on your own server with PM2

Example Dockerfile:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Option 3: Private NPM Registry

Host on your own NPM registry for team distribution:

```bash
# Build the package
npm run build

# Publish to your registry
npm publish --registry https://your-registry.com
```

## API Endpoints Required

For self-hosting, your Noverload API needs these endpoints:

- `GET /api/user` - Validate access token
- `GET /api/content` - List saved content
- `GET /api/content/:id` - Get content details
- `POST /api/content` - Save new content
- `GET /api/content/search` - Search content
- `GET /api/actions` - List actions
- `POST /api/actions/:id/complete` - Complete action
- `GET /api/goals` - List goals

## Development

### Project Structure

```
noverload-mcp/
├── packages/
│   ├── mcp-server/       # Main MCP server implementation
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── client.ts     # Noverload API client
│   │   │   ├── tools/        # MCP tools (actions)
│   │   │   └── resources/    # MCP resources
│   │   └── package.json
│   └── mcp-utils/         # Shared utilities
└── package.json           # Workspace root
```

### Testing Locally

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### "Invalid access token"

- Ensure your token is correctly copied
- Check if the token has expired
- Verify you're using the correct API URL

### "Client not initialized"

- Restart your AI assistant after configuration changes
- Check the configuration JSON syntax

### Tools not appearing

- Ensure the MCP server is properly configured
- Check your AI assistant's MCP logs
- Try reinstalling the package

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/noverload-mcp/issues)
- Documentation: [Noverload Docs](https://docs.noverload.app)
- Discord: [Join our community](https://discord.gg/noverload)
