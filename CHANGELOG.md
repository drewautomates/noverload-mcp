# Changelog

## [0.6.0-beta.1] - 2025-08-31

### 🎯 Beta Release: Stability and Reliability Improvements

This beta release focuses on improving stability, reliability, and error handling based on early user feedback and testing.

#### Added

- Enhanced error handling for expired tokens with clear user guidance
- Improved configuration validation with better error messages
- More robust API response error handling
- Clearer error messages for common configuration issues

#### Changed

- **Configuration**: Now exclusively uses environment variables for improved reliability and consistency
- **Initialization**: Streamlined process for better stability
- **Token Validation**: Enhanced flow with specific handling for authentication errors
- **Error Reporting**: More informative messages to help troubleshoot issues

#### Fixed

- Configuration loading edge cases resolved
- TypeScript warnings cleaned up
- General stability improvements throughout the codebase
- Error message clarity enhanced

#### Developer Experience

- Simplified configuration approach
- More predictable error handling
- Better alignment with MCP protocol best practices
- Improved debugging with clearer error messages

## [0.5.0] - 2025-08-25

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

For more details on the v2 API, see the [API Reference](https://www.noverload.com/docs/integrations/api)
