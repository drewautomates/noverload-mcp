import { z } from "zod";
import { Tool } from "../types.js";
import { analyzeConnections, groupConnectionsByType, getConnectionTypeEmoji, calculateNetworkStats } from "../helpers/connections.js";

export const findConnectionsTool: Tool = {
  name: "find_connections",
  description: "Discover connections and relationships between different pieces of content. Identifies causal links, contradictions, and complementary information.",
  inputSchema: {
    type: "object",
    properties: {
      contentIds: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Array of content IDs to find connections between",
      },
      connectionType: {
        type: "string",
        enum: ["all", "causal", "contradictory", "complementary", "sequential"],
        description: "Type of connections to find",
        default: "all",
      },
      depth: {
        type: "number",
        description: "How many levels deep to search for connections (1-3)",
        default: 1,
      },
    },
    required: ["contentIds"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      contentIds: z.array(z.string()).min(2),
      connectionType: z.enum(["all", "causal", "contradictory", "complementary", "sequential"]).optional().default("all"),
      depth: z.number().min(1).max(3).optional().default(1),
    });
    const params = schema.parse(args);
    
    // Fetch all content items
    const contents = await client.batchGetContent(params.contentIds, false);
    
    if (!contents.results || contents.results.length < 2) {
      return {
        content: [
          {
            type: "text",
            text: "Unable to find connections. Need at least 2 valid content items.",
          },
        ],
        data: null,
      };
    }
    
    // Analyze connections between content
    const connections = analyzeConnections(contents.results, params.connectionType);
    
    let responseText = `# 🔗 Content Connections Analysis\n`;
    responseText += `**Analyzing:** ${contents.results.length} pieces of content\n`;
    responseText += `**Connection Type:** ${params.connectionType}\n`;
    responseText += `**Connections Found:** ${connections.length}\n\n`;
    
    if (connections.length === 0) {
      responseText += `No ${params.connectionType} connections found between the provided content.\n`;
      responseText += `Try using connectionType='all' for broader analysis.\n`;
    } else {
      // Group connections by type
      const byType = groupConnectionsByType(connections);
      
      Object.entries(byType).forEach(([type, conns]: [string, any]) => {
        responseText += `## ${getConnectionTypeEmoji(type)} ${type} Connections (${conns.length})\n\n`;
        
        conns.slice(0, 5).forEach((conn: any) => {
          responseText += `### ${conn.source1.title} ↔️ ${conn.source2.title}\n`;
          responseText += `**Relationship:** ${conn.relationship}\n`;
          responseText += `**Strength:** ${conn.strength.toFixed(2)}\n`;
          if (conn.explanation) {
            responseText += `**Why:** ${conn.explanation}\n`;
          }
          if (conn.sharedConcepts && conn.sharedConcepts.length > 0) {
            responseText += `**Shared Concepts:** ${conn.sharedConcepts.join(', ')}\n`;
          }
          responseText += `\n`;
        });
      });
      
      // Network summary
      responseText += `## 🌐 Connection Network Summary\n`;
      const networkStats = calculateNetworkStats(connections, contents.results);
      responseText += `- **Most Connected:** ${networkStats.mostConnected.title} (${networkStats.mostConnected.connectionCount} connections)\n`;
      responseText += `- **Central Theme:** ${networkStats.centralTheme}\n`;
      responseText += `- **Network Density:** ${networkStats.density}\n`;
      
      if (params.depth > 1) {
        responseText += `\n## 🔍 Extended Connections (Depth ${params.depth})\n`;
        responseText += `*Searching for indirect connections through related content...*\n`;
        responseText += `Use find_similar_content on highly connected items to explore further.\n`;
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
        connections,
        contents: contents.results,
        networkStats: connections.length > 0 ? calculateNetworkStats(connections, contents.results) : null,
      },
    };
  },
};