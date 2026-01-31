#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { NoverloadClient } from "./client.js";
import { resources } from "./resources/index.js";
import { tools } from "./tools/index.js";

const ConfigSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  apiUrl: z.string().url().optional().default("https://www.noverload.com"),
  readOnly: z.boolean().optional().default(true),
});

type Config = z.infer<typeof ConfigSchema>;

async function main() {
  // Log tools status at startup
  console.error(`MCP Server starting with ${tools ? tools.length : 0} tools`);
  if (!tools || tools.length === 0) {
    console.error("WARNING: No tools loaded! Check imports.");
  }

  const transport = new StdioServerTransport();

  // Provide instructions for LLMs on context management
  const instructions = `Noverload MCP: Smart knowledge management with context-aware retrieval.

## Philosophy
Noverload handles storage and retrieval. You handle thinking.
Use these tools to GET content, then apply your reasoning to analyze, connect, and synthesize.

## Available Tools (${tools?.length || 0})
${tools && tools.length > 0 ? tools.map((t) => t.name).join(", ") : "none"}

## Retrieval Decision Tree

**Start here:** What does the user need?

1. **"Summarize/synthesize across my content"** → \`explore_topic\`
   - Returns pre-extracted insights, frameworks, and patterns across sources
   - Context-efficient (~1-2k tokens vs 20k+ for raw content)
   - Best for: research, finding themes, cross-content analysis

2. **"Find specific content about X"** → \`search_content\`
   - Semantic search with RAG (understands concepts, not just keywords)
   - Returns summaries + metadata (~200 tokens per result)
   - Use \`tags\` filter to narrow results
   - Best for: finding relevant sources before deep-diving

3. **"Give me the full details"** → \`get_content_details\`
   - Returns complete transcript/article text + all metadata
   - Use ONLY when you need exact quotes or full context
   - Check token count before retrieving (shown in response)

4. **"What frameworks/processes exist?"** → \`noverload_extract_frameworks\`
   - Returns structured methodologies with steps, use cases, confidence
   - Best for: learning HOW to do something from saved content

## Recommended Workflows

**Quick question about saved content:**
\`\`\`
search_content(query) → find relevant items → answer from summaries
\`\`\`

**Deep research / synthesis:**
\`\`\`
explore_topic(topic, depth: "comprehensive") → get synthesized insights
  ↓ (if needed)
get_content_details(id) → get specific quotes/full context
\`\`\`

**Learning a methodology:**
\`\`\`
noverload_extract_frameworks(query) → get structured processes with steps
\`\`\`

**Creating a report across multiple sources:**
\`\`\`
explore_topic(topic) → get themes + connections
  ↓
batch_get_content(ids) → get full text for key sources only
\`\`\`

## Token Management
| Tool | Typical Size | When to Use |
|------|--------------|-------------|
| explore_topic | ~1-2k tokens | First choice for multi-source questions |
| search_content | ~200/result | Finding relevant content |
| get_content_details | 1k-50k+ tokens | Only when full text needed |
| noverload_extract_frameworks | ~500-2k tokens | Learning processes/methods |

## Key Principle
**Start broad, go narrow.** Use explore_topic or search_content first. Only fetch full content when you need exact quotes or deep analysis.`;

  const server = new McpServer(
    {
      name: "noverload-mcp",
      version: "0.9.1",
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: {},
        prompts: {},
      },
      instructions,
    }
  );

  let client: NoverloadClient | null = null;
  let config: Config | null = null;

  // Convert JSON Schema to a Zod raw shape for McpServer.registerTool
  function jsonSchemaToZodShape(schema: any): Record<string, z.ZodTypeAny> {
    const shape: Record<string, z.ZodTypeAny> = {};
    if (!schema || schema.type !== "object" || !schema.properties) return shape;
    const requiredList: string[] = Array.isArray(schema.required)
      ? schema.required
      : [];
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      let t: z.ZodTypeAny;
      if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
        t = z.enum(prop.enum as [string, ...string[]]);
      } else if (prop.type === "string") {
        t = z.string();
      } else if (prop.type === "number" || prop.type === "integer") {
        t = z.number();
      } else if (prop.type === "boolean") {
        t = z.boolean();
      } else if (prop.type === "array") {
        const items = (prop.items ?? {}) as any;
        let itemType: z.ZodTypeAny = z.unknown();
        if (items.enum && Array.isArray(items.enum) && items.enum.length > 0) {
          itemType = z.enum(items.enum as [string, ...string[]]);
        } else if (items.type === "string") {
          itemType = z.string();
        } else if (items.type === "number" || items.type === "integer") {
          itemType = z.number();
        } else if (items.type === "boolean") {
          itemType = z.boolean();
        }
        t = z.array(itemType);
      } else if (prop.type === "object") {
        t = z.object({}).passthrough();
      } else {
        t = z.unknown();
      }
      if (!requiredList.includes(key)) {
        t = t.optional();
      }
      shape[key] = t;
    }
    return shape;
  }

  // Register tools using McpServer so the SDK advertises and handles list/call automatically
  for (const t of tools) {
    const zodShape = jsonSchemaToZodShape(t.inputSchema as any);
    server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: zodShape,
        annotations: {
          readOnlyHint: !t.modifies,
          destructiveHint: t.modifies === true,
        },
      },
      async (args) => {
        if (!client) {
          const rawConfig = process.env.NOVERLOAD_CONFIG;
          if (!rawConfig) {
            throw new Error(
              "Configuration required. Set NOVERLOAD_CONFIG environment variable."
            );
          }
          try {
            config = ConfigSchema.parse(JSON.parse(rawConfig));
            client = new NoverloadClient(config);
            await client.initialize();
          } catch (error) {
            throw new Error(`Invalid configuration: ${error}`);
          }
        }
        // Delegate to existing tool handler (validates args internally)
        return (await t.handler(client, args)) as any;
      }
    );
  }

  // Minimal prompts support to satisfy clients that expect prompts
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    // No built-in prompts; report unknown
    throw new Error(`Unknown prompt: ${request.params.name}`);
  });

  // CallTool is handled automatically by McpServer for registered tools

  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.error("ListResources handler called");
    if (!client) {
      const rawConfig = process.env.NOVERLOAD_CONFIG;
      if (!rawConfig) {
        throw new Error(
          "Configuration required. Set NOVERLOAD_CONFIG environment variable."
        );
      }

      try {
        config = ConfigSchema.parse(JSON.parse(rawConfig));
        client = new NoverloadClient(config);
        await client.initialize();
      } catch (error) {
        throw new Error(`Invalid configuration: ${error}`);
      }
    }

    const resourceList = await resources.list(client);
    return {
      resources: resourceList,
    };
  });

  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      if (!client) {
        const rawConfig = process.env.NOVERLOAD_CONFIG;
        if (!rawConfig) {
          throw new Error(
            "Configuration required. Set NOVERLOAD_CONFIG environment variable."
          );
        }

        try {
          config = ConfigSchema.parse(JSON.parse(rawConfig));
          client = new NoverloadClient(config);
          await client.initialize();
        } catch (error) {
          throw new Error(`Invalid configuration: ${error}`);
        }
      }

      return await resources.read(client, request.params.uri);
    }
  );

  // Some clients defer listing tools until they receive a tools/list_changed notification.
  // Register the hook before connecting to avoid race conditions.
  server.server.oninitialized = async () => {
    try {
      await server.sendToolListChanged();
    } catch (err) {
      console.error("Failed to send tools/list_changed notification:", err);
    }
  };
  await server.connect(transport);
  console.error("Noverload MCP Server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
