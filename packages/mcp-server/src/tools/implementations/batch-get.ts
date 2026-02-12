import { z } from "zod";
import { Tool } from "../types.js";

export const batchGetContentTool: Tool = {
  name: "batch_get_content",
  description: "Fetch multiple content items by their IDs in one request. Use after search_content to retrieve specific items. Returns summaries by default. Set includeFullContent: true for full text (tokens are additive across items - 5 articles could be 50k+ tokens).",
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
    
    // The v2 endpoint returns { success, contents, metadata }
    const contents = result.contents || result.results || result;
    const resultCount = Array.isArray(contents) ? contents.length : 0;
    
    let responseText = `# Batch Content Fetch\n\n`;
    responseText += `Requested: ${params.ids.length} items\n`;
    responseText += `Found: ${resultCount} items\n`;
    
    // Calculate and warn about total tokens
    let totalTokens = 0;
    if (contents && Array.isArray(contents) && contents.length > 0) {
      contents.forEach((item: any) => {
        if (item.tokenCount || item.token_count) {
          totalTokens += item.tokenCount || item.token_count;
        }
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
    
    if (contents && Array.isArray(contents) && contents.length > 0) {
      contents.forEach((item: any, idx: number) => {
        if (item.error) {
          responseText += `## ${idx + 1}. Error: ${item.id}\n`;
          responseText += `${item.error}\n\n`;
        } else {
          // Handle different field name variations from the API
          const contentType = item.contentType || item.type || item.content_type;
          const tokenCount = item.tokenCount || item.token_count;
          const rawText = item.rawText || item.raw_text;
          
          responseText += `## ${idx + 1}. ${item.title || "Untitled"}\n`;
          responseText += `**ID:** ${item.id}\n`;
          responseText += `**Type:** ${contentType} | **URL:** ${item.url}\n`;
          if (tokenCount) {
            responseText += `**Tokens:** ${tokenCount.toLocaleString()}`;
            if (tokenCount > 10000) responseText += ` ⚠️`;
            responseText += `\n`;
          }
          if (item.summary) {
            responseText += `**Summary:** ${typeof item.summary === "string" ? item.summary : item.summary.one_sentence || "N/A"}\n`;
          }
          if (params.includeFullContent && rawText) {
            responseText += `\n**Full Content:**\n`;
            responseText += rawText;
            responseText += `\n`;
          }
          responseText += `\n`;
        }
      });
    } else {
      responseText += `\n⚠️ No content items were returned. Possible causes:\n`;
      responseText += `- The IDs may not exist\n`;
      responseText += `- The content may belong to another user\n`;
      responseText += `- The IDs format may be incorrect (should be UUIDs)\n`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        results: contents,
        metadata: result.metadata || {
          found: resultCount,
          requested: params.ids.length,
        },
      },
    };
  },
};