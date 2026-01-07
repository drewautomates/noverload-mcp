import { z } from "zod";
import { Tool } from "../types.js";

export const buildKnowledgeGraphTool: Tool = {
  name: "build_knowledge_graph",
  description: "Create a knowledge graph showing relationships between concepts, topics, and content in your saved knowledge base",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Central topic for the knowledge graph",
      },
      maxNodes: {
        type: "number",
        description: "Maximum number of nodes in the graph",
        default: 20,
      },
      depth: {
        type: "number",
        description: "How many levels of connections to explore (1-3)",
        default: 2,
      },
      includeStats: {
        type: "boolean",
        description: "Include statistics about connections",
        default: true,
      },
    },
    required: ["topic"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      topic: z.string(),
      maxNodes: z.number().optional().default(20),
      depth: z.number().min(1).max(3).optional().default(2),
      includeStats: z.boolean().optional().default(true),
    });
    const params = schema.parse(args);
    
    // Search for content related to the topic
    const searchResults = await client.searchContent(params.topic, {
      limit: params.maxNodes * 2, // Get extra for better graph
      enableConceptExpansion: true,
    });
    
    if (!searchResults || searchResults.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No content found for topic: "${params.topic}". Cannot build knowledge graph without saved content.`,
          },
        ],
        data: null,
      };
    }
    
    // Build the graph structure
    const nodes = new Map<string, any>();
    const edges = new Map<string, Set<string>>();
    
    // Add central topic node
    nodes.set(params.topic.toLowerCase(), {
      id: params.topic.toLowerCase(),
      label: params.topic,
      type: "central",
      weight: searchResults.length,
    });
    
    // Process search results to extract concepts and relationships
    searchResults.forEach((item: any) => {
      // Add content as a node
      const contentId = `content_${item.id}`;
      nodes.set(contentId, {
        id: contentId,
        label: item.title || "Untitled",
        type: "content",
        contentType: item.contentType,
        url: item.url,
        weight: 1,
      });
      
      // Connect content to central topic
      if (!edges.has(params.topic.toLowerCase())) {
        edges.set(params.topic.toLowerCase(), new Set());
      }
      edges.get(params.topic.toLowerCase())!.add(contentId);
      
      // Extract and add concept nodes from tags and summary
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => {
          const tagId = `tag_${tag.toLowerCase()}`;
          
          if (!nodes.has(tagId)) {
            nodes.set(tagId, {
              id: tagId,
              label: tag,
              type: "concept",
              weight: 0,
            });
          }
          
          // Increase weight for repeated concepts
          nodes.get(tagId)!.weight++;
          
          // Connect tag to content
          if (!edges.has(contentId)) {
            edges.set(contentId, new Set());
          }
          edges.get(contentId)!.add(tagId);
          
          // Connect tag to central topic
          edges.get(params.topic.toLowerCase())!.add(tagId);
        });
      }
      
      // Extract key concepts from summary if available
      if (item.summary) {
        const summary = typeof item.summary === 'string' 
          ? item.summary 
          : item.summary.one_sentence || item.summary.text || "";
          
        // Simple concept extraction (words that appear to be important)
        const words = summary.toLowerCase().split(/\s+/);
        const importantWords = words
          .filter((w: string) => w.length > 6 && !['through', 'between', 'because', 'without'].includes(w))
          .slice(0, 3);
          
        importantWords.forEach((word: string) => {
          const conceptId = `concept_${word}`;
          
          if (!nodes.has(conceptId) && nodes.size < params.maxNodes) {
            nodes.set(conceptId, {
              id: conceptId,
              label: word,
              type: "derived",
              weight: 1,
            });
            
            // Connect to content
            if (!edges.has(contentId)) {
              edges.set(contentId, new Set());
            }
            edges.get(contentId)!.add(conceptId);
          }
        });
      }
    });
    
    // For depth > 1, find second-level connections
    if (params.depth > 1) {
      const firstLevelNodes = Array.from(edges.get(params.topic.toLowerCase()) || []);
      
      for (const nodeId of firstLevelNodes.slice(0, 10)) { // Limit for performance
        if (nodeId.startsWith('tag_') || nodeId.startsWith('concept_')) {
          // Find content that shares this concept
          const concept = nodes.get(nodeId)?.label;
          if (concept) {
            const relatedResults = await client.searchContent(concept, {
              limit: 5,
              enableConceptExpansion: false,
            });
            
            relatedResults?.forEach((item: any) => {
              const relatedId = `related_${item.id}`;
              if (!nodes.has(relatedId) && nodes.size < params.maxNodes) {
                nodes.set(relatedId, {
                  id: relatedId,
                  label: item.title || "Related Content",
                  type: "related",
                  contentType: item.contentType,
                  url: item.url,
                  weight: 1,
                });
                
                // Connect to the concept
                if (!edges.has(nodeId)) {
                  edges.set(nodeId, new Set());
                }
                edges.get(nodeId)!.add(relatedId);
              }
            });
          }
        }
      }
    }
    
    // Format response
    let responseText = `# 🕸️ Knowledge Graph: "${params.topic}"\n`;
    responseText += `**Nodes:** ${nodes.size} | **Depth:** ${params.depth}\n\n`;
    
    // Node breakdown
    const nodeTypes = new Map<string, number>();
    nodes.forEach(node => {
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    });
    
    responseText += `## 📊 Graph Structure\n`;
    responseText += `- **Central Topic:** ${params.topic}\n`;
    nodeTypes.forEach((count, type) => {
      const typeEmoji: Record<string, string> = {
        content: "📄",
        concept: "💡",
        derived: "🔍",
        related: "🔗",
        central: "🎯",
      };
      responseText += `- **${typeEmoji[type] || "•"} ${type}:** ${count} nodes\n`;
    });
    responseText += `\n`;
    
    // Key concepts (highest weight nodes)
    const conceptNodes = Array.from(nodes.values())
      .filter(n => n.type === 'concept' || n.type === 'derived')
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
    
    if (conceptNodes.length > 0) {
      responseText += `## 💡 Key Concepts\n`;
      conceptNodes.forEach((node, idx) => {
        responseText += `${idx + 1}. **${node.label}** (strength: ${node.weight})\n`;
      });
      responseText += `\n`;
    }
    
    // Content clusters
    const contentNodes = Array.from(nodes.values())
      .filter(n => n.type === 'content')
      .slice(0, 10);
    
    if (contentNodes.length > 0) {
      responseText += `## 📚 Core Content\n`;
      contentNodes.forEach((node, idx) => {
        const typeIcons: Record<string, string> = {
          youtube: "📺",
          x_twitter: "𝕏",
          reddit: "🔗",
          article: "📄",
          pdf: "📑"
        };
        const icon = typeIcons[node.contentType] || "📄";
        responseText += `${idx + 1}. ${icon} [${node.label}](${node.url})\n`;
      });
      responseText += `\n`;
    }
    
    // Connection statistics
    if (params.includeStats) {
      responseText += `## 🔗 Connection Statistics\n`;
      
      // Find most connected nodes
      const connectionCounts = new Map<string, number>();
      edges.forEach((connections, nodeId) => {
        connectionCounts.set(nodeId, connections.size);
      });
      
      const mostConnected = Array.from(connectionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      responseText += `**Most Connected Nodes:**\n`;
      mostConnected.forEach(([nodeId, count]) => {
        const node = nodes.get(nodeId);
        if (node) {
          responseText += `- ${node.label}: ${count} connections\n`;
        }
      });
      responseText += `\n`;
      
      // Graph density
      const possibleEdges = nodes.size * (nodes.size - 1) / 2;
      const actualEdges = Array.from(edges.values()).reduce((sum, set) => sum + set.size, 0);
      const density = ((actualEdges / possibleEdges) * 100).toFixed(1);
      
      responseText += `**Graph Metrics:**\n`;
      responseText += `- Density: ${density}%\n`;
      responseText += `- Average connections: ${(actualEdges / nodes.size).toFixed(1)}\n`;
      responseText += `- Total edges: ${actualEdges}\n`;
    }
    
    // Visualization suggestion
    responseText += `\n## 🎨 Visualization\n`;
    responseText += `The knowledge graph contains:\n`;
    responseText += `- ${nodes.size} nodes representing concepts and content\n`;
    responseText += `- ${Array.from(edges.values()).reduce((sum, set) => sum + set.size, 0)} edges showing relationships\n\n`;
    responseText += `💡 **Tip:** Use the graph data in the response to create visual representations with tools like D3.js or Graphviz.\n`;
    
    // Convert to serializable format
    const graphData = {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.entries()).flatMap(([source, targets]) =>
        Array.from(targets).map(target => ({ source, target }))
      ),
    };
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        topic: params.topic,
        graph: graphData,
        statistics: {
          nodeCount: nodes.size,
          edgeCount: graphData.edges.length,
          nodeTypes: Object.fromEntries(nodeTypes),
          depth: params.depth,
        },
      },
    };
  },
};