import { z } from "zod";
import { NoverloadClient } from "../../client.js";
import { Tool } from "../types.js";

const inputSchema = z.object({
  exampleType: z
    .enum([
      "case_study",
      "success_story",
      "failure",
      "transformation",
      "implementation",
      "all",
    ])
    .optional()
    .default("all")
    .describe("Type of examples to find"),
  domain: z
    .string()
    .optional()
    .describe(
      "Specific domain or topic area (e.g., 'marketing', 'growth', 'product development')"
    ),
  includeMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include quantitative metrics and numbers"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of examples to return"),
});

interface Example {
  type: string;
  title: string;
  description: string;
  context: string;
  metrics?: {
    metric: string;
    value: string;
    timeframe?: string;
  }[];
  lessons?: string[];
  sourceContent: {
    id: string;
    title: string;
    url: string;
    type: string;
  };
  relevanceScore?: number;
}

export const findExamplesTool: Tool = {
  name: "noverload_find_examples",
  description:
    "Search for specific examples, case studies, success stories, or transformations in your saved content. Great for finding proof points and real-world applications.",
  inputSchema: {
    type: "object",
    properties: {
      exampleType: {
        type: "string",
        enum: [
          "case_study",
          "success_story",
          "failure",
          "transformation",
          "implementation",
          "all",
        ],
        default: "all",
        description: "Type of examples to find",
      },
      domain: {
        type: "string",
        description:
          "Specific domain or topic area (e.g., 'marketing', 'growth', 'product development')",
      },
      includeMetrics: {
        type: "boolean",
        default: true,
        description: "Include quantitative metrics and numbers",
      },
      limit: {
        type: "number",
        default: 10,
        description: "Maximum number of examples to return",
      },
    },
  },
  modifies: false,

  handler: async (client: NoverloadClient, args: unknown) => {
    const input = inputSchema.parse(args);

    try {
      // Build search query based on example type
      let searchQuery = "";

      switch (input.exampleType) {
        case "case_study":
          searchQuery = "case study example real world implementation results";
          break;
        case "success_story":
          searchQuery =
            "success story achievement milestone reached goal win victory";
          break;
        case "failure":
          searchQuery =
            "failure mistake lesson learned wrong failed error problem";
          break;
        case "transformation":
          searchQuery =
            "transformation before after change transition journey from to";
          break;
        case "implementation":
          searchQuery =
            "implementation built created developed launched shipped deployed";
          break;
        default:
          searchQuery =
            "example case study story results implementation real world";
      }

      if (input.domain) {
        searchQuery = `${input.domain} ${searchQuery}`;
      }

      // Search for content with examples
      const searchResults = await client.searchContentV2({
        query: searchQuery,
        mode: "any",
        limit: 30, // Get more to filter through
      });

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `🔍 No content found with ${input.exampleType === "all" ? "examples" : input.exampleType.replace("_", " ")}. Try saving content with real-world case studies and stories.`,
            },
          ],
          data: {
            examples: [],
            totalFound: 0,
            searchQuery: searchQuery,
          },
        };
      }

      // Extract examples from content
      const allExamples: Example[] = [];

      for (const result of searchResults.results) {
        // Check if content has extracted examples in ai_insights
        if (result.aiInsights?.extracted_examples) {
          for (const ex of result.aiInsights.extracted_examples) {
            // Filter by type if specified
            if (input.exampleType !== "all" && ex.type !== input.exampleType) {
              continue;
            }

            allExamples.push({
              type: ex.type || input.exampleType,
              title: ex.title || ex.description.substring(0, 50),
              description: ex.description,
              context: ex.context || "",
              metrics: ex.key_numbers
                ? Object.entries(ex.key_numbers).map(([k, v]) => ({
                    metric: k,
                    value: String(v),
                    timeframe: ex.timeframe,
                  }))
                : undefined,
              lessons: ex.lessons || [],
              sourceContent: {
                id: result.id,
                title: result.title || "Untitled",
                url: result.url,
                type: result.contentType,
              },
              relevanceScore: result.relevance,
            });
          }
        }

        // Also look for examples in the summary or key insights
        if (result.summary && typeof result.summary === "object") {
          const summaryObj = result.summary as any;

          // Check for case studies or examples mentioned
          if (summaryObj.important_quotes) {
            for (const quote of summaryObj.important_quotes) {
              // Look for patterns indicating examples
              if (
                quote.match(/\$[\d,]+|[\d]+%|[\d]+x|grew|increased|achieved/i)
              ) {
                allExamples.push({
                  type: "success_story",
                  title: "Success Metric",
                  description: quote,
                  context: "Found in content quotes",
                  sourceContent: {
                    id: result.id,
                    title: result.title || "Untitled",
                    url: result.url,
                    type: result.contentType,
                  },
                  relevanceScore: result.relevance,
                });
              }
            }
          }
        }
      }

      // Sort by relevance and limit
      allExamples.sort(
        (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
      );
      const limitedExamples = allExamples.slice(0, input.limit);

      // Format response
      let responseText = `📚 **Found ${allExamples.length} examples**\n\n`;

      if (input.exampleType !== "all") {
        responseText += `Type: ${input.exampleType.replace("_", " ")}\n`;
      }
      if (input.domain) {
        responseText += `Domain: ${input.domain}\n`;
      }
      responseText += `\n`;

      // Group examples by type
      const byType = limitedExamples.reduce(
        (acc, ex) => {
          if (!acc[ex.type]) acc[ex.type] = [];
          acc[ex.type].push(ex);
          return acc;
        },
        {} as Record<string, Example[]>
      );

      for (const [type, examples] of Object.entries(byType)) {
        const typeEmoji =
          type === "case_study"
            ? "📊"
            : type === "success_story"
              ? "🎯"
              : type === "failure"
                ? "⚠️"
                : type === "transformation"
                  ? "🔄"
                  : type === "implementation"
                    ? "🛠️"
                    : "📌";

        responseText += `\n## ${typeEmoji} ${type.replace("_", " ").toUpperCase()}\n\n`;

        for (const ex of examples) {
          responseText += `### ${ex.title}\n`;
          responseText += `${ex.description}\n\n`;

          // Add metrics if available and requested
          if (input.includeMetrics && ex.metrics && ex.metrics.length > 0) {
            responseText += `**📈 Metrics:**\n`;
            for (const metric of ex.metrics) {
              responseText += `- **${metric.metric}**: ${metric.value}`;
              if (metric.timeframe) {
                responseText += ` (${metric.timeframe})`;
              }
              responseText += `\n`;
            }
            responseText += `\n`;
          }

          // Add lessons if available
          if (ex.lessons && ex.lessons.length > 0) {
            responseText += `**💡 Key Lessons:**\n`;
            for (const lesson of ex.lessons) {
              responseText += `- ${lesson}\n`;
            }
            responseText += `\n`;
          }

          // Add source
          const icon =
            ex.sourceContent.type === "youtube"
              ? "📺"
              : ex.sourceContent.type === "x_twitter"
                ? "𝕏"
                : ex.sourceContent.type === "reddit"
                  ? "🟠"
                  : ex.sourceContent.type === "pdf"
                    ? "📄"
                    : "📖";
          responseText += `*Source: ${icon} [${ex.sourceContent.title}](${ex.sourceContent.url})*\n\n`;
        }
      }

      // Count common themes
      const themes: Record<string, number> = {};

      // Add patterns observed
      if (allExamples.length > 0) {
        responseText += `\n---\n🔍 **Patterns Observed:**\n`;
        for (const ex of allExamples) {
          // Extract common words/themes from descriptions
          const words = ex.description
            .toLowerCase()
            .match(
              /\b(growth|revenue|users|customers|traffic|conversion|engagement|retention)\b/g
            );
          if (words) {
            for (const word of words) {
              themes[word] = (themes[word] || 0) + 1;
            }
          }
        }

        // Show top themes
        const topThemes = Object.entries(themes)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        if (topThemes.length > 0) {
          responseText += `**Common themes:** ${topThemes.map(([theme, count]) => `${theme} (${count})`).join(", ")}\n`;
        }

        // Summary stats
        responseText += `\n**Summary:**\n`;
        responseText += `- Total examples found: ${allExamples.length}\n`;
        responseText += `- Content sources: ${new Set(allExamples.map((e) => e.sourceContent.id)).size}\n`;

        if (allExamples.length > input.limit) {
          responseText += `\n*Showing top ${input.limit} examples. Increase limit to see more.*`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        data: {
          examples: limitedExamples,
          totalFound: allExamples.length,
          byType: Object.fromEntries(
            Object.entries(byType).map(([type, exs]) => [type, exs.length])
          ),
          searchQuery: searchQuery,
          themes: Object.entries(themes || {})
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10),
        },
      };
    } catch (error) {
      console.error("Find examples error:", error);

      return {
        content: [
          {
            type: "text",
            text: `❌ Error finding examples: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        error: true,
      };
    }
  },
};
