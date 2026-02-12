import { z } from "zod";
import { Tool } from "../types.js";
import { generateTokenWarning } from "../utils/context-warnings.js";

export const listSavedContentTool: Tool = {
  name: "list_saved_content",
  description: "Browse saved content with optional filters (status, type). Returns titles, summaries, and metadata. Best for discovering what's saved or checking processing status. For topic-specific queries, use search_content instead.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "processing", "completed", "failed"],
        description: "Filter by processing status",
      },
      contentType: {
        type: "string",
        enum: ["youtube", "x_twitter", "reddit", "article", "pdf"],
        description: "Filter by content type",
      },
      limit: {
        type: "number",
        description: "Maximum number of items to return (default: 20, recommended: ≤10 for detailed view)",
        default: 20,
      },
    },
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
      contentType: z.enum(["youtube", "x_twitter", "reddit", "article", "pdf"]).optional(),
      limit: z.number().optional().default(20),
    });
    const params = schema.parse(args);
    const content = await client.listContent(params);
    
    // Calculate estimated token usage for awareness
    const estimatedTokens = content.reduce((sum, item) => {
      // Estimate based on summary + metadata (not full content)
      return sum + (item.summary ? 200 : 50) + 100; // metadata overhead
    }, 0);
    
    // Build detailed response
    let responseText = `# Saved Content Library\n`;
    responseText += `Found ${content.length} items`;
    
    const filters = [];
    if (params.status) filters.push(`status: ${params.status}`);
    if (params.contentType) filters.push(`type: ${params.contentType}`);
    if (filters.length > 0) {
      responseText += ` (filtered by ${filters.join(', ')})`;
    }
    
    // Add token usage note if listing many items
    if (content.length > 10) {
      responseText += `\n📊 **Note:** Listing ${content.length} items with summaries (~${estimatedTokens.toLocaleString()} tokens)`;
      responseText += `\n💡 **Tip:** Use search or filters to find specific content more efficiently`;
    }
    
    responseText += `\n\n`;
    
    if (content.length > 0) {
      content.forEach((item, idx) => {
        responseText += `## ${idx + 1}. ${item.title || 'Untitled'}\n`;
        responseText += `**ID:** ${item.id}\n`;
        responseText += `**Type:** ${item.contentType} | **Status:** ${item.status}`;
        if (item.tokenCount) {
          responseText += ` | **Size:** ${item.tokenCount.toLocaleString()} tokens`;
          if (item.tokenCount > 50000) {
            responseText += ` 🚨`;
          } else if (item.tokenCount > 10000) {
            responseText += ` ⚠️`;
          }
        }
        responseText += `\n**URL:** ${item.url}\n`;
        
        if (item.summary) {
          const summaryObj = typeof item.summary === 'string' 
            ? { text: item.summary } 
            : item.summary;
          
          if (summaryObj.one_sentence) {
            responseText += `**Summary:** ${summaryObj.one_sentence}\n`;
          }
        }
        
        if (item.createdAt) {
          responseText += `**Saved:** ${new Date(item.createdAt).toLocaleDateString()}\n`;
        }
        responseText += '\n---\n\n';
      });
    } else {
      responseText += "No content found matching the specified filters.";
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: content,
    };
  },
};