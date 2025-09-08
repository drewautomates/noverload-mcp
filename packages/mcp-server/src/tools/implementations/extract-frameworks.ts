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
    .default(0.7)
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
  name: "noverload_extract_frameworks",
  description:
    "Extract methodologies, frameworks, and step-by-step processes from your saved content. Finds structured approaches, patterns, and repeatable techniques.",
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
        default: 0.7,
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
        "framework methodology process steps guide how to tutorial";

      // Search for relevant content
      const searchResults = await client.searchContentV2({
        query: searchQuery,
        mode: "any",
        limit: 30, // Get more results to find frameworks
        contentTypes: input.contentTypes,
      });

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "🔍 No content found that might contain frameworks. Try saving content about methodologies, tutorials, or how-to guides first.",
            },
          ],
          data: {
            frameworks: [],
            totalFound: 0,
            searchQuery: searchQuery,
          },
        };
      }

      // Collect all frameworks from content with ai_insights
      const allFrameworks: Framework[] = [];
      const contentWithFrameworks: string[] = [];

      for (const result of searchResults.results) {
        // Check if this content has ai_insights with frameworks
        if (result.aiInsights?.frameworks) {
          const frameworks = result.aiInsights.frameworks;

          for (const fw of frameworks) {
            if (fw.confidence >= input.minConfidence) {
              allFrameworks.push({
                ...fw,
                sourceContent: {
                  id: result.id,
                  title: result.title || "Untitled",
                  url: result.url,
                  type: result.contentType,
                },
              });
            }
          }

          if (frameworks.length > 0) {
            contentWithFrameworks.push(result.id);
          }
        }
      }

      // If no frameworks found in ai_insights, trigger extraction for top results
      if (allFrameworks.length === 0) {
        // Extract frameworks from top 5 most relevant results
        const topResults = searchResults.results.slice(0, 5);

        let extractionMessage =
          "🔄 No pre-extracted frameworks found. Analyzing content for frameworks...\n\n";

        for (const content of topResults) {
          if (!content.rawText && !content.summary) {
            continue;
          }

          // Note: In production, this would call the extract-frameworks Edge Function
          // For now, we'll indicate that extraction is needed
          extractionMessage += `📝 ${content.title} - Needs framework extraction\n`;
        }

        return {
          content: [
            {
              type: "text",
              text:
                extractionMessage +
                "\n💡 Tip: Content processing will extract frameworks automatically. Try again in a few moments, or use the 'noverload_process_content' tool to trigger processing.",
            },
          ],
          data: {
            frameworks: [],
            totalFound: 0,
            contentNeedingExtraction: topResults.map((r: any) => r.id),
            searchQuery: searchQuery,
          },
        };
      }

      // Sort frameworks by confidence and limit
      allFrameworks.sort((a, b) => b.confidence - a.confidence);
      const limitedFrameworks = allFrameworks.slice(0, input.limit);

      // Format response
      let responseText = `🎯 **Found ${allFrameworks.length} frameworks**\n\n`;

      if (input.query) {
        responseText += `Search: "${input.query}"\n`;
      }
      responseText += `Minimum confidence: ${input.minConfidence}\n\n`;

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
      responseText += `- Total frameworks found: ${allFrameworks.length}\n`;
      responseText += `- High confidence (>90%): ${allFrameworks.filter((f) => f.confidence > 0.9).length}\n`;
      responseText += `- Content sources analyzed: ${contentWithFrameworks.length}\n`;

      if (allFrameworks.length > input.limit) {
        responseText += `\n*Showing top ${input.limit} frameworks. Increase limit to see more.*`;
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
          contentSources: contentWithFrameworks,
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
