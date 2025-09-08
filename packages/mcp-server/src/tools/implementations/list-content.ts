import { z } from "zod";
import { Tool } from "../types.js";

export const listSavedContentTool: Tool = {
  name: "list_saved_content",
  description: "List saved content from Noverload with full details including titles, summaries, and insights. Optionally filter by status or content type.",
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
        description: "Maximum number of items to return",
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
    
    // Build detailed response
    let responseText = `# Saved Content Library\n`;
    responseText += `Found ${content.length} items`;
    
    const filters = [];
    if (params.status) filters.push(`status: ${params.status}`);
    if (params.contentType) filters.push(`type: ${params.contentType}`);
    if (filters.length > 0) {
      responseText += ` (filtered by ${filters.join(', ')})`;
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
        
        responseText += `**Saved:** ${new Date(item.createdAt).toLocaleDateString()}\n`;
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