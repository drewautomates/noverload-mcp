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
        "framework methodology process steps guide how to tutorial system approach";

      // Use synthesis to extract frameworks from relevant content
      const synthesisResult = await client.synthesizeContent({
        query: `Extract frameworks, methodologies, and processes related to: ${searchQuery}`,
        synthesisMode: "actionable",
        maxSources: 30,
      });

      // Handle multiple possible response formats
      const synthData = synthesisResult.synthesis || synthesisResult;
      const insights = synthData.insights || synthData.actionableInsights || synthesisResult.insights || synthesisResult.actionableInsights || [];

      if (!insights || insights.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "🔍 No frameworks found in your saved content. Try saving content about methodologies, tutorials, or how-to guides first.",
            },
          ],
          data: {
            frameworks: [],
            totalFound: 0,
            searchQuery: searchQuery,
          },
        };
      }

      // Extract frameworks from synthesis insights
      const allFrameworks: Framework[] = [];
      const frameworkPattern = /(?:framework|methodology|process|approach|system|technique|method|strategy):\s*(.+)/i;

      for (const insight of insights) {
        // Check if this insight describes a framework
        const text = typeof insight === 'string' ? insight : (insight as any).text || (insight as any).insight;
        const source = typeof insight === 'object' ? (insight as any).source : null;
        
        // Look for framework indicators
        if (text && (
          text.toLowerCase().includes('framework') ||
          text.toLowerCase().includes('methodology') ||
          text.toLowerCase().includes('process') ||
          text.toLowerCase().includes('step') ||
          text.toLowerCase().includes('approach') ||
          text.toLowerCase().includes('system')
        )) {
          // Extract framework name from the text
          let frameworkName = text;
          const match = text.match(/(?:^|\b)([A-Z][A-Za-z0-9\s\-&]+(?:Framework|Method|Process|System|Approach|Model|Strategy))/);
          if (match) {
            frameworkName = match[1].trim();
          } else {
            // Try to extract a reasonable name from the first part
            frameworkName = text.split(/[:,.]/)[0].trim();
            if (frameworkName.length > 50) {
              frameworkName = frameworkName.substring(0, 50) + "...";
            }
          }

          // Determine framework type
          let type: Framework["type"] = "framework";
          if (text.toLowerCase().includes('methodology')) type = "methodology";
          else if (text.toLowerCase().includes('process')) type = "process";
          else if (text.toLowerCase().includes('pattern')) type = "pattern";
          else if (text.toLowerCase().includes('technique')) type = "technique";

          const framework: Framework = {
            name: frameworkName,
            type: type,
            description: text,
            useCases: [],
            confidence: 0.8, // Default confidence since synthesis doesn't provide it
            sourceContent: source ? {
              id: source.id || "unknown",
              title: source.title || "Unknown Source",
              url: source.url || "",
              type: source.type || "article",
            } : undefined,
          };

          // Extract steps if mentioned
          const stepRegex = /(?:step\s+)?(\d+)[.:\s]+([^.]+)/gi;
          const steps: Array<{order: number; title: string; description: string}> = [];
          let stepMatch;
          let stepIdx = 0;
          while ((stepMatch = stepRegex.exec(text)) !== null) {
            steps.push({
              order: parseInt(stepMatch[1] || '1') || stepIdx + 1,
              title: `Step ${stepMatch[1] || stepIdx + 1}`,
              description: (stepMatch[2] || '').trim(),
            });
            stepIdx++;
          }
          
          if (steps.length > 0) {
            framework.steps = steps;
          }

          allFrameworks.push(framework);
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
      responseText += `- Sources analyzed: ${synthesisResult.sources?.length || 0}\n`;

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
