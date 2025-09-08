import { z } from "zod";
import { Tool } from "../types.js";

export const batchGetContentTool: Tool = {
  name: "batch_get_content",
  description: "Fetch multiple content items in a single request. Efficient for bulk operations.",
  inputSchema: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Array of content IDs to fetch",
      },
      includeFullContent: {
        type: "boolean",
        description: "Include full text content (warning: may use many tokens)",
        default: false,
      },
    },
    required: ["ids"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      ids: z.array(z.string()).min(1).max(50),
      includeFullContent: z.boolean().optional().default(false),
    });
    const params = schema.parse(args);
    const result = await client.batchGetContent(params.ids, params.includeFullContent);
    
    let responseText = `# Batch Content Fetch\n\n`;
    responseText += `Requested: ${params.ids.length} items\n`;
    responseText += `Found: ${result.metadata?.found || 0} items\n`;
    
    // Calculate and warn about total tokens
    let totalTokens = 0;
    if (result.results && result.results.length > 0) {
      result.results.forEach((item: any) => {
        if (item.tokenCount) totalTokens += item.tokenCount;
      });
    }
    
    if (params.includeFullContent && totalTokens > 0) {
      responseText += `\n⚠️ **Full Content Included - Total Size: ${totalTokens.toLocaleString()} tokens**`;
      if (totalTokens > 100000) {
        responseText += ` 🚨 EXTREMELY LARGE!\n`;
        responseText += `WARNING: This WILL consume most or all of your context window!\n`;
        responseText += `Consider setting includeFullContent: false to just get summaries.\n`;
      } else if (totalTokens > 50000) {
        responseText += ` 🚨 VERY LARGE!\n`;
        responseText += `This is consuming significant context. Use with caution.\n`;
      } else if (totalTokens > 10000) {
        responseText += ` ⚠️\n`;
      } else {
        responseText += `\n`;
      }
    } else if (!params.includeFullContent && totalTokens > 0) {
      responseText += `\n💡 **Showing summaries only.** Total content available: ~${totalTokens.toLocaleString()} tokens.\n`;
      responseText += `Rich metadata (summaries, tags, insights) included with minimal token usage.\n`;
    }
    
    responseText += `\n`;
    
    if (result.results && result.results.length > 0) {
      result.results.forEach((item: any, idx: number) => {
        if (item.error) {
          responseText += `## ${idx + 1}. Error: ${item.id}\n`;
          responseText += `${item.error}\n\n`;
        } else {
          responseText += `## ${idx + 1}. ${item.title || "Untitled"}\n`;
          responseText += `**ID:** ${item.id}\n`;
          responseText += `**Type:** ${item.contentType} | **URL:** ${item.url}\n`;
          if (item.tokenCount) {
            responseText += `**Tokens:** ${item.tokenCount.toLocaleString()}`;
            if (item.tokenCount > 10000) responseText += ` ⚠️`;
            responseText += `\n`;
          }
          if (item.summary) {
            responseText += `**Summary:** ${typeof item.summary === "string" ? item.summary : item.summary.one_sentence || "N/A"}\n`;
          }
          if (params.includeFullContent && item.fullContent) {
            responseText += `**Content Length:** ${item.metadata?.contentLength || 0} characters\n`;
          }
          responseText += `\n`;
        }
      });
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: result,
    };
  },
};