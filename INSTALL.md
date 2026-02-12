# Noverload MCP Installation Guide

This guide will walk you through installing and configuring the Noverload MCP server for your AI assistant.

## Prerequisites

- **Node.js v18+** and npm installed ([Download Node.js](https://nodejs.org))
- **Noverload Pro account** with an active subscription or trial
- **AI Assistant** (Claude Desktop, Cursor, or Windsurf)

## Step 1: Get Your Personal Access Token

1. Log in to [Noverload](https://noverload.com)
2. Navigate to [Dashboard Settings](https://noverload.com/dashboard/settings)
3. Find the "Personal Access Tokens" section
4. Click "New Token" and give it a descriptive name (e.g., "Claude MCP")
5. **Important**: Copy your token immediately - it won't be shown again!

> 💡 **Tip**: Store your token in a password manager for safekeeping.

## Step 2: Choose Your Installation Method

### Recommended: Zero-Install with NPX

This is the **easiest approach** - no installation needed! Just copy and paste:

```json
{
  "mcpServers": {
    "noverload": {
      "command": "npx",
      "args": ["-y", "noverload-mcp@latest"],
      "env": {
        "NOVERLOAD_CONFIG": "{\"accessToken\":\"YOUR_TOKEN_HERE\",\"apiUrl\":\"https://noverload.com\",\"readOnly\":true}"
      }
    }
  }
}
```

**Pros**: 
- ✅ No installation required
- ✅ Always uses the latest version
- ✅ Works immediately
- ✅ Automatic updates

**Cons**: 
- Slightly slower on first startup (downloads package)

### Alternative: Global Install

Install once, use everywhere:

1. First, install globally:
```bash
npm install -g noverload-mcp
```

2. Then use this configuration:
```json
{
  "mcpServers": {
    "noverload": {
      "command": "noverload-mcp",
      "args": [],
      "env": {
        "NOVERLOAD_CONFIG": "{\"accessToken\":\"YOUR_TOKEN_HERE\",\"apiUrl\":\"https://noverload.com\",\"readOnly\":true}"
      }
    }
  }
}
```

**Pros**: Fastest startup, full control over version  
**Cons**: Requires manual updates

## Step 3: Add to Your AI Assistant

### Claude Desktop

1. Find your configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Open the file in a text editor (create it if it doesn't exist)

3. Add or merge the configuration from Step 2

4. Replace `YOUR_TOKEN_HERE` with your actual token

5. Save the file

6. Restart Claude Desktop completely

### Cursor

1. Open Cursor
2. Go to Settings → Features → Model Context Protocol
3. Click "Add Configuration"
4. Paste the configuration from Step 2
5. Replace `YOUR_TOKEN_HERE` with your actual token
6. Save and restart Cursor

### Windsurf

1. Open Windsurf
2. Navigate to Settings → MCP Configuration
3. Click "Add Server"
4. Paste the configuration from Step 2
5. Replace `YOUR_TOKEN_HERE` with your actual token
6. Apply settings and restart

## Step 4: Verify the Connection

1. **Restart your AI assistant completely** (quit and reopen)

2. **Check for the Noverload server**:
   - In Claude: Look for "noverload" in the context menu (📎 icon)
   - In Cursor: Check the MCP panel
   - In Windsurf: View active MCP servers

3. **Test with a simple query**:
   - Try: "What content have I saved in Noverload?"
   - Or: "List my recent saved YouTube videos"

## Troubleshooting

### "Command not found" or "noverload-mcp not found"

**Solution**: Use the recommended NPX method instead (no installation needed)

### "Invalid access token"

**Solutions**:
- Double-check you copied the entire token
- Ensure there are no extra spaces or quotes
- Generate a new token if needed

### Server not appearing in AI assistant

**Solutions**:
- Make sure you saved the configuration file
- Check the JSON syntax is valid (no missing commas or brackets)
- Restart the AI assistant completely (not just reload)
- On Windows: Ensure Node.js is in your system PATH

### "npx: command not found"

**Solution**: Install Node.js from [nodejs.org](https://nodejs.org), which includes npm and npx

### No content returned

**Solutions**:
- Verify you have saved and processed content in Noverload
- Check your subscription is active (Pro or trial)
- Content must be fully processed to appear in searches

## Configuration Options

### Read-Only Mode (Default)

```json
"readOnly": true
```
Recommended for safety - prevents accidental modifications

### Write Access

```json
"readOnly": false
```
Allows saving new content and completing actions - use with caution

### Custom API URL (Advanced)

```json
"apiUrl": "https://your-custom-api.com"
```
Only needed for self-hosted instances

## Security Best Practices

1. **Keep your token secret** - Never share it publicly
2. **Use read-only mode** unless you specifically need write access
3. **Revoke unused tokens** from your Noverload settings
4. **Create separate tokens** for different use cases
5. **Monitor token usage** in your dashboard

## Getting Help

- **Documentation**: [Noverload Docs](https://noverload.com/docs/integrations/mcp)
- **Issues**: [GitHub Issues](https://github.com/noverload/mcp-server/issues)
- **Support**: support@noverload.com

## Testing Your Installation

Once configured, restart your AI assistant and try these queries:

- "Search my Noverload content about productivity"
- "What YouTube videos have I saved about AI?"
- "Show me action items from my marketing content"
- "Synthesize insights from my saved articles about startups"
- "Find content similar to my last saved video"

---

**Happy searching! 🚀** Your entire knowledge base is now accessible to your AI assistant.