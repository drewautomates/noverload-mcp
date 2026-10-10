import { NoverloadClient } from "../client.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  modifies: boolean;
  // Feature key from billing.entitlements (e.g. "noverload.lens"). When set, the tool
  // is only registered for users whose /api/user features include it.
  requiredFeature?: string;
  handler: (client: NoverloadClient, args: unknown) => Promise<{ 
    content: Array<{ type: string; text: string }>, 
    data?: unknown 
  }>;
}

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  data?: unknown;
}