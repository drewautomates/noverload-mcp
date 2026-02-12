import { z } from "zod";
import { NoverloadClient } from "../../client.js";
import { Tool } from "../types.js";

// Interface for synthesis insight from API
interface SynthesisInsight {
  text?: string;
  insight?: string;
  source?: {
    id?: string;
    title?: string;
    url?: string;
    type?: string;
  };
}

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

/**
 * Calculate confidence score for a framework based on various factors
 */
function calculateFrameworkConfidence(
  name: string,
  description: string,
  steps: Array<{order: number; title: string; description: string}>,
  hasSource: boolean
): number {
  let confidence = 0.5; // Base confidence

  // Named framework pattern (e.g., "MOAT Framework", "3-Step Method")
  const namedFrameworkPattern = /\b([A-Z][A-Za-z0-9\-]+\s+)?(Framework|Method|Process|System|Approach|Model|Strategy|Technique)\b/i;
  if (namedFrameworkPattern.test(name)) {
    confidence += 0.15;
  }

  // Has numbered/lettered prefix (e.g., "3-Step", "4-Part", "ABC")
  if (/\b\d+[-\s]?(step|part|phase|stage|point|pillar)/i.test(name) || /\b[A-Z]{2,5}\b/.test(name)) {
    confidence += 0.1;
  }

  // Has clear steps extracted
  if (steps.length >= 2) {
    confidence += 0.1;
    if (steps.length >= 4) {
      confidence += 0.05; // More steps = more structured
    }
  }

  // Description quality
  if (description.length > 100) {
    confidence += 0.05;
  }
  if (description.length > 200) {
    confidence += 0.05;
  }

  // Has source attribution
  if (hasSource) {
    confidence += 0.05;
  }

  // Cap at 0.95
  return Math.min(0.95, Math.round(confidence * 100) / 100);
}

export const extractFrameworksTool: Tool = {
  name: "extract_frameworks",
  description:
    "Extract structured methodologies, step-by-step processes, and repeatable techniques from saved content. Returns named frameworks with steps, components, and confidence scores (0-1). Use when learning HOW to do something. Optionally filter by query (e.g., 'marketing frameworks') or content type.",
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

      for (const rawInsight of insights) {
        // Normalize insight to our interface
        const insight: SynthesisInsight = typeof rawInsight === 'string'
          ? { text: rawInsight }
          : rawInsight as SynthesisInsight;

        // Check if this insight describes a framework
        const text = insight.text || insight.insight;
        const source = insight.source || null;
        
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

          // Extract steps first - more strict regex to avoid false positives
          // Matches patterns like: "Step 1:", "1.", "1)", "1 -" at start of text or after newline/period
          const stepRegex = /(?:^|[.\n]\s*)(?:step\s+)?(\d{1,2})(?:\.|:|\.|\)|\s+-)\s+([A-Z][^.\n]{10,80})/gim;
          const steps: Array<{order: number; title: string; description: string}> = [];
          const seenOrders = new Set<number>();
          let stepMatch;

          while ((stepMatch = stepRegex.exec(text)) !== null) {
            const order = parseInt(stepMatch[1]);
            const stepDescription = (stepMatch[2] || '').trim();

            // Skip if we've seen this order (duplicate), order is too high (likely not a step),
            // or description is too short (likely a false positive like "4 key elements")
            if (seenOrders.has(order) || order > 20 || stepDescription.length < 10) {
              continue;
            }

            // Skip if it looks like a number in content (e.g., "8 seconds", "4 key elements")
            if (/^\d+\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?|key|main|core|primary|steps?|elements?|things?|items?|points?)/i.test(stepMatch[0])) {
              continue;
            }

            seenOrders.add(order);
            steps.push({
              order: order,
              title: `Step ${order}`,
              description: stepDescription,
            });
          }

          // Sort steps by order
          steps.sort((a, b) => a.order - b.order);

          // Calculate dynamic confidence based on framework quality
          const hasSource = !!source;
          const confidence = calculateFrameworkConfidence(frameworkName, text, steps, hasSource);

          const framework: Framework = {
            name: frameworkName,
            type: type,
            description: text,
            useCases: [],
            confidence: confidence,
            sourceContent: source ? {
              id: source.id || "unknown",
              title: source.title || "Unknown Source",
              url: source.url || "",
              type: source.type || "article",
            } : undefined,
            steps: steps.length > 0 ? steps : undefined,
          };

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
      responseText += `- Sources analyzed: ${synthesisResult.sources?.length || 0}\n`;

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
