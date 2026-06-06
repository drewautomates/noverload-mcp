import { z } from "zod";
import { NoverloadClient } from "../../client.js";
import { Tool } from "../types.js";

const inputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional: specific framework type to find"),
  contentTypes: z
    .array(z.enum(["youtube", "x_twitter", "reddit", "article", "pdf"]))
    .optional()
    .describe("Filter by content types"),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.5)
    .describe("Minimum confidence score for frameworks (0-1)"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of frameworks to return"),
});

interface Framework {
  name: string;
  type: "methodology" | "process" | "framework" | "pattern" | "technique";
  description: string;
  steps?: {
    order: number;
    title: string;
    description: string;
    example?: string;
  }[];
  components?: {
    name: string;
    description: string;
    importance: "critical" | "important" | "optional";
  }[];
  useCases: string[];
  confidence: number;
  sourceContent?: {
    id: string;
    title: string;
    url: string;
    type: string;
  };
  examples?: {
    description: string;
    outcome?: string;
  }[];
}


export const extractFrameworksTool: Tool = {
  name: "extract_frameworks",
  description: `Extract named, step-by-step methodologies from saved content (~500–2k tokens).

Returns an array of frameworks, each shaped like:
  {
    name: "CLEAR Framework",
    type: "methodology" | "process" | "framework" | "pattern" | "technique",
    description: "...",
    steps: [{ order: 1, title: "...", description: "...", example?: "..." }, ...],
    components?: [{ name, description, importance: "critical"|"important"|"optional" }],
    useCases: ["...", "..."],
    confidence: 0.0–1.0,   // filtered by minConfidence (default 0.5)
    sourceContent: { id, title, url, type }
  }

Use for: "how do I do X", learning a process, building a checklist from saved content, comparing methodologies across creators. Different from explore_topic — this returns actionable steps, not themes. Pass query="marketing" to narrow to a domain.`,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional: specific framework type to find",
      },
      contentTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ["youtube", "x_twitter", "reddit", "article", "pdf"],
        },
        description: "Filter by content types",
      },
      minConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        description: "Minimum confidence score for frameworks (0-1)",
      },
      limit: {
        type: "number",
        default: 20,
        description: "Maximum number of frameworks to return",
      },
    },
  },
  modifies: false,

  handler: async (client: NoverloadClient, args: unknown) => {
    const input = inputSchema.parse(args);

    try {
      // First, get content that might contain frameworks
      const searchQuery =
        input.query ||
        "framework methodology process steps guide how to tutorial system approach";

      // Pull structured substrate. Frameworks already carry their real steps from
      // ai_insights — no regex-scraping of prose. IMPORTANT: pass the clean topic
      // as the query; wrapping it in boilerplate pollutes the semantic embedding.
      // Keep maxSources tight when a topic is named so relevance actually
      // constrains the set (the bug a reviewer hit: a 30-source library returned
      // all 30). With a specific topic, "no relevant matches" must mean "no
      // frameworks found" — not frameworks from random recent saves.
      const substrateResult = await client.getSubstrate({
        query: searchQuery,
        maxSources: input.query ? 12 : 25,
        contentTypes: input.contentTypes,
        allowRecentFallback: !input.query,
      });

      const substrate = substrateResult.substrate;

      if (!substrate || substrate.frameworks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text:
                substrateResult.error ||
                "🔍 No frameworks found in your saved content. Try saving content about methodologies, tutorials, or how-to guides first.",
            },
          ],
          data: {
            frameworks: [],
            totalFound: 0,
            searchQuery: searchQuery,
          },
        };
      }

      // Join source metadata (url/type) from sourceRelationships by id.
      const sourceMeta = new Map(
        substrate.sourceRelationships.map((s) => [s.sourceId, s])
      );

      // Map substrate frameworks (real steps + confidence) into our shape.
      let allFrameworks: Framework[] = substrate.frameworks.map((f) => {
        const meta = sourceMeta.get(f.sourceId);
        const validType = (
          ["methodology", "process", "framework", "pattern", "technique"] as const
        ).includes(f.type as Framework["type"])
          ? (f.type as Framework["type"])
          : "framework";
        return {
          name: f.name,
          type: validType,
          description: f.description,
          steps: f.steps.length > 0 ? f.steps : undefined,
          components:
            f.components.length > 0
              ? f.components.map((c) => ({
                  name: c.name,
                  description: c.description,
                  importance: (["critical", "important", "optional"].includes(
                    c.importance
                  )
                    ? c.importance
                    : "important") as "critical" | "important" | "optional",
                }))
              : undefined,
          useCases: f.useCases,
          confidence: f.confidence,
          sourceContent: f.sourceId
            ? {
                id: f.sourceId,
                title: f.sourceTitle || meta?.title || "Unknown Source",
                url: meta?.url || "",
                type: meta?.type || "article",
              }
            : undefined,
        };
      });

      // When the user named a topic, keep only frameworks that actually match it —
      // the synthesis endpoint surfaces every framework from the matched sources.
      if (input.query) {
        const keywords = input.query
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2);
        if (keywords.length > 0) {
          allFrameworks = allFrameworks.filter((f) => {
            const haystack = `${f.name} ${f.description}`.toLowerCase();
            return keywords.some((k) => haystack.includes(k));
          });
        }
      }

      if (allFrameworks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "🔍 No clear frameworks found in the synthesis results. Your content may not contain structured methodologies or processes.",
            },
          ],
          data: {
            frameworks: [],
            totalFound: 0,
            searchQuery: searchQuery,
          },
        };
      }

      // Filter by minConfidence, sort by confidence, and limit
      const filteredFrameworks = allFrameworks.filter(fw => fw.confidence >= input.minConfidence);
      filteredFrameworks.sort((a, b) => b.confidence - a.confidence);
      const limitedFrameworks = filteredFrameworks.slice(0, input.limit);

      // Format response
      const showingCount = limitedFrameworks.length;
      const aboveThreshold = filteredFrameworks.length;
      let responseText = `🎯 **Found ${aboveThreshold} frameworks** (above ${(input.minConfidence * 100).toFixed(0)}% confidence)\n\n`;

      if (input.query) {
        responseText += `Search: "${input.query}"\n`;
      }
      if (aboveThreshold < allFrameworks.length) {
        responseText += `*${allFrameworks.length - aboveThreshold} additional frameworks below confidence threshold*\n`;
      }
      responseText += `\n`;

      // Group frameworks by type
      const byType = limitedFrameworks.reduce(
        (acc, fw) => {
          if (!acc[fw.type]) acc[fw.type] = [];
          acc[fw.type].push(fw);
          return acc;
        },
        {} as Record<string, Framework[]>
      );

      for (const [type, frameworks] of Object.entries(byType)) {
        responseText += `\n## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`;

        for (const fw of frameworks) {
          responseText += `### 📋 ${fw.name}\n`;
          responseText += `*Confidence: ${(fw.confidence * 100).toFixed(0)}%*\n`;
          responseText += `${fw.description}\n\n`;

          // Add steps if available
          if (fw.steps && fw.steps.length > 0) {
            responseText += `**Steps:**\n`;
            for (const step of fw.steps) {
              responseText += `${step.order}. **${step.title}**: ${step.description}\n`;
              if (step.example) {
                responseText += `   *Example: ${step.example}*\n`;
              }
            }
            responseText += `\n`;
          }

          // Add components if available
          if (fw.components && fw.components.length > 0) {
            responseText += `**Components:**\n`;
            for (const comp of fw.components) {
              const importance =
                comp.importance === "critical"
                  ? "🔴"
                  : comp.importance === "important"
                    ? "🟡"
                    : "⚪";
              responseText += `- ${importance} **${comp.name}**: ${comp.description}\n`;
            }
            responseText += `\n`;
          }

          // Add use cases
          if (fw.useCases && fw.useCases.length > 0) {
            responseText += `**Use Cases:** ${fw.useCases.join(", ")}\n`;
          }

          // Add source
          if (fw.sourceContent) {
            const icon =
              fw.sourceContent.type === "youtube"
                ? "📺"
                : fw.sourceContent.type === "x_twitter"
                  ? "𝕏"
                  : fw.sourceContent.type === "reddit"
                    ? "🟠"
                    : fw.sourceContent.type === "pdf"
                      ? "📄"
                      : "📖";
            responseText += `*Source: ${icon} [${fw.sourceContent.title}](${fw.sourceContent.url})*\n\n`;
          }
        }
      }

      // Add summary statistics
      responseText += `\n---\n📊 **Summary:**\n`;
      responseText += `- Showing: ${showingCount} of ${aboveThreshold} frameworks (≥${(input.minConfidence * 100).toFixed(0)}% confidence)\n`;
      responseText += `- High confidence (>90%): ${filteredFrameworks.filter((f) => f.confidence > 0.9).length}\n`;
      responseText += `- Sources analyzed: ${substrate.sourcesAnalyzed}\n`;

      if (aboveThreshold > input.limit) {
        responseText += `\n*Showing top ${input.limit} frameworks. Increase limit to see more.*`;
      }
      if (input.minConfidence > 0.5 && allFrameworks.length > aboveThreshold) {
        responseText += `\n*Lower minConfidence to see ${allFrameworks.length - aboveThreshold} more frameworks.*`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        data: {
          frameworks: limitedFrameworks,
          totalFound: allFrameworks.length,
          byType: Object.fromEntries(
            Object.entries(byType).map(([type, fws]) => [type, fws.length])
          ),
          searchQuery: searchQuery,
        },
      };
    } catch (error) {
      console.error("Framework extraction error:", error);

      return {
        content: [
          {
            type: "text",
            text: `❌ Error extracting frameworks: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        error: true,
      };
    }
  },
};
