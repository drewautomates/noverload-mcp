import { z } from "zod";
import { Tool } from "../types.js";

export const findSimilarContentTool: Tool = {
  name: "find_similar_content",
  description: "Find content similar to a specific saved item using semantic similarity.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "ID of the content to find similar items for",
      },
      limit: {
        type: "number",
        description: "Maximum number of similar items to return",
        default: 5,
      },
      minSimilarity: {
        type: "number",
        description: "Minimum similarity score (0-1)",
        default: 0.7,
      },
    },
    required: ["contentId"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string(),
      limit: z.number().optional().default(5),
      minSimilarity: z.number().optional().default(0.7),
    });
    const params = schema.parse(args);
    const result = await client.findSimilarContent(params.contentId, {
      limit: params.limit,
      minSimilarity: params.minSimilarity,
    });
    
    let responseText = `# Similar Content to: ${result.source?.title || "Unknown"}\n\n`;
    
    if (result.similarContent && result.similarContent.length > 0) {
      responseText += `Found ${result.similarContent.length} similar items:\n\n`;
      result.similarContent.forEach((item: any, idx: number) => {
        responseText += `## ${idx + 1}. ${item.title || "Untitled"}\n`;
        responseText += `**Similarity:** ${(item.similarity * 100).toFixed(1)}%\n`;
        responseText += `**Type:** ${item.type || item.contentType || "unknown"} | **URL:** ${item.url}\n`;
        if (item.summary) {
          responseText += `**Summary:** ${item.summary}\n`;
        }
        responseText += `\n`;
      });
    } else {
      responseText += `No similar content found with similarity >= ${params.minSimilarity}`;
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