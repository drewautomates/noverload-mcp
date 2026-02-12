# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noverload MCP Server is a Model Context Protocol (MCP) implementation that connects Noverload's knowledge management system to AI assistants like Claude, Cursor, and Windsurf. It enables AI tools to access and interact with saved content (YouTube, X posts, Reddit, articles, PDFs) through a structured API.

## Architecture

- **Type System**: TypeScript with ES2022 modules
- **Protocol**: MCP SDK for server/client communication
- **API**: Noverload API v2 with enhanced search and synthesis
- **Transport**: StdioServerTransport for process communication
- **Validation**: Zod schemas for runtime type safety

## Common Commands

```bash
# Development
npm install          # Install dependencies
npm run dev         # Run development server with hot reload
npm run build       # Build TypeScript to dist/
npm run typecheck   # Type check without building
npm run test        # Run tests with Vitest

# Format code
npm run format      # Format all files with Prettier
npm run format:check # Check formatting without modifying

# Production
npm run start       # Run built server from dist/
```

## Key Architecture Patterns

### MCP Server Implementation

The server (`packages/mcp-server/src/index.ts`) follows MCP patterns:
- Lazy initialization of NoverloadClient on first tool request
- Configuration via NOVERLOAD_CONFIG environment variable or CLI args
- Read-only mode by default for safety
- Tools and resources are registered with proper handlers

### Client Architecture

`packages/mcp-server/src/client.ts` implements the Noverload API client:
- All API responses validated with Zod schemas
- Supports both v1 and v2 API endpoints
- Token estimation and content synthesis for advanced features
- Graceful error handling with detailed messages

### Tool Design Patterns

Tools in `packages/mcp-server/src/tools/index.ts` follow these patterns:
- Each tool has `inputSchema` for parameter validation
- `modifies` flag indicates if tool writes data (respects read-only mode)
- Rich formatted responses with visual indicators (emojis for content types, size warnings)
- Dual response: human-readable text + structured data
- Token awareness with warnings for large content

### API Integration

- **v2 Endpoints**: Enhanced search, synthesis, batch operations
- **Token Management**: Estimates and warnings for context window management
- **Search Modes**: Smart, semantic, fulltext with OR/AND logic
- **Content Synthesis**: Multi-source analysis with contradictions and connections

## Important Implementation Details

### Configuration Schema
```typescript
{
  accessToken: string,      // Required: Personal access token
  apiUrl: string,          // Default: "https://noverload.com"
  readOnly: boolean        // Default: true (safety first)
}
```

### Content Type Handling
- Enum types: `youtube`, `x_twitter`, `reddit`, `article`, `pdf`
- Status tracking: `pending`, `processing`, `completed`, `failed`
- Token counting for context management
- Summary objects support multiple formats (string or structured)

### Search Implementation
- Enhanced search with multiple modes (any/all/phrase)
- Fuzzy matching and concept expansion
- Tag filtering and domain exclusion
- Token estimation before full search
- Relevance scoring and explanations

### Error Handling
- Detailed error messages from API responses
- Proper HTTP status code handling
- Configuration validation with helpful messages
- Client initialization verification

## Development Guidelines

### Type Safety
- Never use `any` - all data validated with Zod
- Export types from schemas for consistency
- Validate all external API responses
- Use proper error types with instanceof checks

### Testing Strategy
- Test API client methods with mocked responses
- Validate tool input/output schemas
- Ensure configuration validation works correctly
- Test both v1 and v2 API endpoint compatibility

### Performance Considerations
- Lazy client initialization to reduce startup time
- Batch operations for multiple content fetches
- Token estimation to prevent context overflow
- Efficient search with proper filtering

## Publishing and Distribution

```bash
# Build for NPM
npm run build

# NPX usage (zero-install)
npx -y noverload-mcp@latest

# Global install
npm install -g noverload-mcp
```

The package is configured for public NPM distribution with proper bin entry point.

## Monorepo Structure

```
noverload-mcp/
├── packages/
│   ├── mcp-server/      # Main MCP implementation
│   │   ├── src/
│   │   │   ├── index.ts       # Server entry point
│   │   │   ├── client.ts      # API client
│   │   │   ├── tools/         # MCP tool definitions
│   │   │   └── resources/     # MCP resource handlers
│   │   ├── dist/              # Built output
│   │   └── package.json
│   └── mcp-utils/       # Shared utilities (if needed)
└── package.json         # Workspace root
```

## API v2 Migration Notes

The codebase uses Noverload API v2 with these enhancements:
- `/api/mcp/v2/content` - Batch operations and enriched responses
- `/api/mcp/v2/search` - Advanced search with modes and filters
- `/api/mcp/v2/synthesis` - Multi-source content analysis
- `/api/mcp/v2/actions` - Action management with statistics

v1 endpoints are still used for:
- Similar content discovery
- Basic content saving
- Goal management