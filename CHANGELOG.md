# Changelog

## [0.5.0] - 2025-01-31

### 🚀 Major Update: MCP v2 API Migration

#### Changed
- **BREAKING**: Updated all API calls to use the new v2 endpoints
  - Search endpoint: `/api/mcp/search` → `/api/mcp/v2/search`
  - Content endpoint: `/api/mcp/content` → `/api/mcp/v2/content`
  - Actions endpoint: `/api/mcp/actions` → `/api/mcp/v2/actions`
  - Synthesis endpoint: `/api/mcp/synthesize` → `/api/mcp/v2/synthesis`

#### Improved
- **Search**: Now supports multiple modes (smart, hybrid, semantic, fulltext)
- **Content Retrieval**: Added token warnings and confirmation for large content
- **Batch Operations**: Enhanced batch content retrieval with enrichment options
- **Response Handling**: Adapted to new v2 response formats with better error handling
- **Performance**: Benefits from v2 API optimizations (caching, parallel processing)

#### API Compatibility
- Maintains backward compatibility with existing MCP tool interfaces
- Response parsing automatically handles v2 format differences
- Error messages provide more context with error codes

#### Migration Notes
- The MCP client now requires Noverload API v2 endpoints to be available
- Token warnings will appear for content over 10,000 tokens
- Large content (>25,000 tokens) requires explicit confirmation

## [0.4.0] - Previous Release
- Initial MCP implementation with v1 API support

---

For more details on the v2 API, see the [API Reference](https://docs.noverload.ai/api/v2)