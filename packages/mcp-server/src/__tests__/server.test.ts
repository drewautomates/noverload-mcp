/**
 * End-to-end tests: spawn the built MCP server (dist/index.js) against a local mock
 * of the Noverload API and drive it with a real MCP client. No network, no token.
 *
 * Run with `npm test` (builds first).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

const SERVER_ENTRY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/index.js");

interface MockOptions {
  /** Delay before the FIRST /api/user response (ms). Later calls answer immediately. */
  firstUserDelayMs?: number;
  /** Reject every request with 401. */
  rejectToken?: boolean;
  features?: string[];
}

const SOURCE = {
  id: "src-1",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Liquidity Sweeps Explained",
  type: "youtube",
  // Current DB shape: summaries are plain strings, not objects.
  summary: "How to spot liquidity sweeps above highs and below lows.",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function startMockApi(opts: MockOptions): Promise<{ server: Server; url: string; requests: string[] }> {
  const requests: string[] = [];
  let userCalls = 0;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://mock");
    requests.push(`${req.method} ${url.pathname}`);

    if (opts.rejectToken) return json(res, 401, { error: "Invalid or revoked token" });

    if (url.pathname === "/api/user") {
      userCalls += 1;
      const delay = userCalls === 1 ? opts.firstUserDelayMs ?? 0 : 0;
      setTimeout(() => json(res, 200, { id: "user-1", features: opts.features ?? [] }), delay);
      return;
    }
    if (url.pathname === "/api/mcp/v2/search") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body) as { mode?: string };
        requests.push(`search mode=${parsed.mode}`);
      });
      // Server shape as of the 2026-11-05 web deploy: tags both top-level and in metadata.
      return json(res, 200, {
        success: true,
        results: [
          { ...SOURCE, tokenCount: 8100, relevanceScore: 0.38, tags: ["m4-tjr"], metadata: { tags: ["m4-tjr"] } },
          // Older server shape: tags only under metadata, hybrid score > 1.
          { ...SOURCE, id: "src-2", title: "Older shape", relevanceScore: 1.08, metadata: { tags: ["tjr"] } },
        ],
      });
    }
    if (url.pathname === "/api/mcp/v2/content") {
      return json(res, 200, { success: true, contents: [{ ...SOURCE, status: "completed", tokenCount: 8100 }] });
    }
    if (url.pathname === "/api/mcp/goals") {
      return json(res, 200, [
        {
          id: "goal-1",
          userId: "user-1",
          title: "Profitable funded account",
          description: "Pass the M4 eval",
          category: "wealth",
          isActive: true,
          createdAt: "2026-11-01T00:00:00Z",
        },
      ]);
    }
    return json(res, 404, { error: `mock: no route for ${url.pathname}` });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, requests });
    });
  });
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function connect(opts: MockOptions): Promise<{ client: Client; requests: string[] }> {
  const mock = await startMockApi(opts);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    env: {
      ...(process.env as Record<string, string>),
      NOVERLOAD_CONFIG: JSON.stringify({ accessToken: "nv_test_token", apiUrl: mock.url }),
    },
    stderr: "ignore",
  });
  const client = new Client({ name: "noverload-mcp-test", version: "0.0.0" });
  await client.connect(transport);
  cleanups.push(async () => {
    await client.close();
    await new Promise<void>((r) => mock.server.close(() => r()));
  });
  return { client, requests: mock.requests };
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? "").join("\n");
}

async function toolNames(client: Client): Promise<string[]> {
  return (await client.listTools()).tools.map((t) => t.name);
}

describe("feature-gated tools", () => {
  it("registers extract_strategy when the user has noverload.lens", async () => {
    const { client } = await connect({ features: ["noverload.lens"] });
    expect(await toolNames(client)).toContain("extract_strategy");
  });

  it("hides extract_strategy without the feature", async () => {
    const { client } = await connect({ features: [] });
    const names = await toolNames(client);
    expect(names).not.toContain("extract_strategy");
    expect(names).toContain("search_content");
  });

  it("late-registers gated tools and notifies when startup init timed out", async () => {
    // Startup caps /api/user at 8s; answer the first call after 9s.
    const { client } = await connect({ features: ["noverload.lens"], firstUserDelayMs: 9000 });
    expect(await toolNames(client)).not.toContain("extract_strategy");

    let notified = false;
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      notified = true;
    });
    await client.callTool({ name: "list_goals", arguments: {} });

    await vi.waitFor(() => expect(notified).toBe(true), { timeout: 5000 });
    expect(await toolNames(client)).toContain("extract_strategy");
  }, 30000);
});

describe("auth errors", () => {
  it("surfaces a rejected token instead of empty results", async () => {
    const { client } = await connect({ rejectToken: true });
    for (const [name, args] of [
      ["search_content", { query: "orb" }],
      ["list_saved_content", {}],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBe(true);
      expect(text(result), name).toMatch(/rejected the access token/);
    }
  });
});

describe("search_content output", () => {
  it("shows string summaries, tags, size and relevance", async () => {
    const { client, requests } = await connect({});
    const out = text(await client.callTool({ name: "search_content", arguments: { query: "liquidity sweep" } }));

    expect(out).toContain("**Summary:** How to spot liquidity sweeps");
    expect(out).toContain("`m4-tjr`");
    expect(out).toContain("~8,100 tokens");
    expect(out).toContain("**Relevance:** 38% match");
    // Tags nested under metadata (older server) are still read.
    expect(out).toContain("`tjr`");
    // Hybrid rank-fusion scores > 1 are not shown as a percentage.
    expect(out).not.toContain("108%");
    expect(out).toContain("**Relevance score:** 1.08");
    // Default search (fuzzyMatch defaults to true) must use smart/hybrid ranking,
    // not be forced into pure semantic mode.
    expect(requests).toContain("search mode=smart");
  });
});

describe("other tool output", () => {
  it("list_goals prints each goal", async () => {
    const { client } = await connect({});
    const out = text(await client.callTool({ name: "list_goals", arguments: {} }));
    expect(out).toContain("Profitable funded account");
    expect(out).toContain("wealth");
  });

  it("list_saved_content prints string summaries", async () => {
    const { client } = await connect({});
    const out = text(await client.callTool({ name: "list_saved_content", arguments: {} }));
    expect(out).toContain("**Summary:** How to spot liquidity sweeps");
  });
});
