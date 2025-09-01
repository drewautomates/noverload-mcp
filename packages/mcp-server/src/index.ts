#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { NoverloadClient } from "./client.js";
import { tools } from "./tools/index.js";
import { resources } from "./resources/index.js";

const ConfigSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  apiUrl: z.string().url().optional().default("https://www.noverload.com"),
  readOnly: z.boolean().optional().default(true),
});

type Config = z.infer<typeof ConfigSchema>;

async function main() {
  const transport = new StdioServerTransport();
  
  const server = new Server(
    {
      name: "noverload-mcp",
      version: "0.4.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  let client: NoverloadClient | null = null;
  let config: Config | null = null;

  // Initialize with config from environment or args
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!client) {
      const rawConfig = process.env.NOVERLOAD_CONFIG || process.argv[2];
      if (!rawConfig) {
        throw new Error("Configuration required. Set NOVERLOAD_CONFIG environment variable.");
      }
      
      try {
        config = ConfigSchema.parse(JSON.parse(rawConfig));
        client = new NoverloadClient(config);
        await client.initialize();
      } catch (error) {
        throw new Error(`Invalid configuration: ${error}`);
      }
    }

    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!client) {
      throw new Error("Client not initialized");
    }

    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    if (config?.readOnly && tool.modifies) {
      throw new Error(`Tool ${request.params.name} modifies data but server is in read-only mode`);
    }

    return await tool.handler(client, request.params.arguments);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    if (!client) {
      throw new Error("Client not initialized");
    }

    const resourceList = await resources.list(client);
    return {
      resources: resourceList,
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (!client) {
      throw new Error("Client not initialized");
    }

    return await resources.read(client, request.params.uri);
  });

  await server.connect(transport);
  console.error("Noverload MCP Server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});