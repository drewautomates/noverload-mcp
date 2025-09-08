import { z } from "zod";
import { Tool } from "../types.js";
import { extractTypedInsights } from "../helpers/insights.js";

export const extractInsightsTool: Tool = {
  name: "extract_insights",
  description: "Extract specific types of insights across multiple content sources. Finds patterns, contradictions, consensus, or evolution of ideas.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What insights to extract (e.g., 'productivity tips', 'AI risks', 'investment strategies')",
      },
      insightType: {
        type: "string",
        enum: ["patterns", "contradictions", "consensus", "evolution", "actionable", "warnings"],
        description: "Type of insights to extract",
        default: "patterns",
      },
      maxSources: {
        type: "number",
        description: "Maximum number of sources to analyze",
        default: 15,
      },
      minConfidence: {
        type: "number",
        description: "Minimum confidence score for insights (0-1)",
        default: 0.7,
      },
    },
    required: ["query"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      query: z.string(),
      insightType: z.enum(["patterns", "contradictions", "consensus", "evolution", "actionable", "warnings"]).optional().default("patterns"),
      maxSources: z.number().optional().default(15),
      minConfidence: z.number().min(0).max(1).optional().default(0.7),
    });
    const params = schema.parse(args);
    
    // Search for relevant content
    const searchResults = await client.searchContent(params.query, {
      limit: params.maxSources,
      enableConceptExpansion: true,
    });
    
    if (!searchResults || searchResults.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No content found for extracting insights about: "${params.query}"`,
          },
        ],
        data: null,
      };
    }
    
    // Extract insights based on type
    const insights = extractTypedInsights(searchResults, params.query, params.insightType, params.minConfidence);
    
    let responseText = `# 💡 Insight Extraction: "${params.query}"\n`;
    responseText += `**Type:** ${params.insightType} | **Sources:** ${searchResults.length} | **Min Confidence:** ${(params.minConfidence * 100).toFixed(0)}%\n\n`;
    
    if (insights.length === 0) {
      responseText += `No ${params.insightType} insights found with confidence >= ${params.minConfidence}.\n`;
      responseText += `Try lowering the confidence threshold or using a different insight type.\n`;
    } else {
      // Display insights by type
      switch (params.insightType) {
        case "patterns":
          responseText += `## 🔄 Recurring Patterns\n\n`;
          insights.forEach((insight: any, idx: number) => {
            responseText += `### Pattern ${idx + 1}: ${insight.pattern}\n`;
            responseText += `**Frequency:** Appears in ${insight.frequency}/${searchResults.length} sources\n`;
            responseText += `**Confidence:** ${(insight.confidence * 100).toFixed(0)}%\n`;
            responseText += `**Examples:**\n`;
            insight.examples.slice(0, 3).forEach((ex: any) => {
              responseText += `- "${ex.text}" *(${ex.source})*\n`;
            });
            responseText += `\n`;
          });
          break;
          
        case "actionable":
          responseText += `## 🎯 Actionable Insights\n\n`;
          insights.forEach((insight: any, idx: number) => {
            responseText += `### ${idx + 1}. ${insight.action}\n`;
            responseText += `**Why:** ${insight.reasoning}\n`;
            responseText += `**Priority:** ${insight.priority}\n`;
            responseText += `**Evidence from:** ${insight.sources.length} sources\n`;
            if (insight.steps && insight.steps.length > 0) {
              responseText += `**Steps:**\n`;
              insight.steps.forEach((step: string, i: number) => {
                responseText += `${i + 1}. ${step}\n`;
              });
            }
            responseText += `\n`;
          });
          break;
          
        default:
          responseText += `## Insights Found\n\n`;
          insights.forEach((insight: any, idx: number) => {
            responseText += `${idx + 1}. ${insight.text || insight.pattern || "Insight"}\n`;
            if (insight.confidence) {
              responseText += `   Confidence: ${(insight.confidence * 100).toFixed(0)}%\n`;
            }
          });
      }
      
      // Summary statistics
      responseText += `\n## 📊 Extraction Summary\n`;
      responseText += `- **Total Insights:** ${insights.length}\n`;
      responseText += `- **Average Confidence:** ${(insights.reduce((sum: number, i: any) => sum + i.confidence, 0) / insights.length * 100).toFixed(0)}%\n`;
      responseText += `- **Sources Analyzed:** ${searchResults.length}\n`;
      const contributingSources = new Set(insights.flatMap((i: any) => i.sources || []));
      responseText += `- **Contributing Sources:** ${contributingSources.size}\n`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        query: params.query,
        insightType: params.insightType,
        insights,
        sources: searchResults,
      },
    };
  },
};