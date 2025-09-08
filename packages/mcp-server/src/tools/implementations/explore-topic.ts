import { z } from "zod";
import { Tool } from "../types.js";

export const exploreTopicTool: Tool = {
  name: "explore_topic",
  description: "Deep exploration of a topic across all saved content. Provides comprehensive understanding with multiple perspectives, evolution over time, and key concepts.",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The topic to explore comprehensively",
      },
      depth: {
        type: "string",
        enum: ["surface", "comprehensive", "expert"],
        description: "Depth of exploration",
        default: "comprehensive",
      },
      includeTimeline: {
        type: "boolean",
        description: "Include chronological evolution of the topic",
        default: true,
      },
      includeConnections: {
        type: "boolean",
        description: "Find connections to related topics",
        default: true,
      },
      maxSources: {
        type: "number",
        description: "Maximum number of sources to analyze",
        default: 20,
      },
    },
    required: ["topic"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      topic: z.string(),
      depth: z.enum(["surface", "comprehensive", "expert"]).optional().default("comprehensive"),
      includeTimeline: z.boolean().optional().default(true),
      includeConnections: z.boolean().optional().default(true),
      maxSources: z.number().optional().default(20),
    });
    const params = schema.parse(args);
    
    // Search for all content related to the topic
    const searchResults = await client.searchContent(params.topic, {
      limit: params.maxSources,
      enableConceptExpansion: true,
      fuzzyMatch: true,
    });
    
    if (!searchResults || searchResults.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No content found for topic: "${params.topic}". Try saving relevant content first or use a different search term.`,
          },
        ],
        data: null,
      };
    }
    
    // Synthesize the content for deep understanding
    const synthesis = await client.synthesizeContent({
      query: `Comprehensive exploration of ${params.topic}`,
      contentIds: searchResults.slice(0, params.maxSources).map((r: any) => r.id),
      synthesisMode: params.depth === "expert" ? "deep" : params.depth === "surface" ? "overview" : "actionable",
      findConnections: params.includeConnections,
      findContradictions: true,
    });
    
    let responseText = `# 🔍 Topic Exploration: "${params.topic}"\n`;
    responseText += `**Depth:** ${params.depth} | **Sources Analyzed:** ${searchResults.length}\n\n`;
    
    // Overview Section
    responseText += `## 📋 Overview\n`;
    if (synthesis.synthesis?.summary) {
      responseText += `${synthesis.synthesis.summary}\n\n`;
    } else {
      responseText += `Analysis of ${searchResults.length} pieces of content about ${params.topic}.\n\n`;
    }
    
    // Key Insights
    if (synthesis.synthesis?.insights && synthesis.synthesis.insights.length > 0) {
      responseText += `## 💡 Key Insights\n`;
      synthesis.synthesis.insights.slice(0, 10).forEach((insight: any, idx: number) => {
        const text = typeof insight === 'string' ? insight : insight.text;
        responseText += `${idx + 1}. ${text}\n`;
      });
      responseText += `\n`;
    }
    
    // Connections (if found)
    if (params.includeConnections && synthesis.synthesis?.connections) {
      responseText += `## 🔗 Related Topics & Connections\n`;
      synthesis.synthesis.connections.slice(0, 8).forEach((conn: any) => {
        if (typeof conn === 'string') {
          responseText += `- ${conn}\n`;
        } else if (conn.concept) {
          responseText += `- **${conn.concept}**`;
          if (conn.strength) {
            responseText += ` (strength: ${conn.strength})`;
          }
          responseText += `\n`;
        }
      });
      responseText += `\n`;
    }
    
    // Sources
    responseText += `## 📚 Top Sources\n`;
    searchResults.slice(0, 5).forEach((source: any, idx: number) => {
      const typeIcons: Record<string, string> = {
        youtube: "📺",
        x_twitter: "𝕏",
        reddit: "🔗",
        article: "📄",
        pdf: "📑"
      };
      const icon = typeIcons[source.contentType] || "📄";
      responseText += `${idx + 1}. ${icon} [${source.title || "Untitled"}](${source.url})\n`;
    });
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        topic: params.topic,
        depth: params.depth,
        sourcesAnalyzed: searchResults.length,
        synthesis: synthesis.synthesis,
        sources: searchResults,
      },
    };
  },
};