import { NoverloadClient } from "../client.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  modifies: boolean;
  handler: (client: NoverloadClient, args: unknown) => Promise<{ 
    content: Array<{ type: string; text: string }>, 
    data?: unknown 
  }>;
}

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  data?: unknown;
}