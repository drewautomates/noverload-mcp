import { z } from "zod";
import { Tool } from "../types.js";

export const getContentDetailsTool: Tool = {
  name: "get_content_details",
  description: "Get complete details about a specific saved content item including full transcript/article text, AI-generated summary, key insights, and all metadata",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "The ID of the content to retrieve",
      },
    },
    required: ["contentId"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string(),
    });
    const { contentId } = schema.parse(args);
    const content = await client.getContent(contentId);
    
    // Build comprehensive response with all details
    let responseText = `# Content Details: ${content.title || 'Untitled'}\n\n`;
    responseText += `**ID:** ${content.id}\n`;
    responseText += `**Type:** ${content.contentType}\n`;
    responseText += `**Status:** ${content.status}\n`;
    responseText += `**URL:** ${content.url}\n`;
    responseText += `**Saved:** ${new Date(content.createdAt).toLocaleDateString()}\n`;
    
    // Show content size information
    if (content.tokenCount) {
      responseText += `**Full Content Size:** ${content.tokenCount.toLocaleString()} tokens`;
      if (content.tokenCount > 50000) {
        responseText += ` 🚨 EXTREMELY LARGE`;
      } else if (content.tokenCount > 10000) {
        responseText += ` ⚠️ LARGE`;
      }
      responseText += '\n';
    }
    
    if (content.tags && content.tags.length > 0) {
      responseText += `**Tags:** ${content.tags.join(', ')}\n`;
    }
    
    responseText += '\n## Summary & Insights\n';
    
    if (content.summary) {
      const summaryObj = typeof content.summary === 'string' 
        ? { text: content.summary } 
        : content.summary;
      
      if (summaryObj.one_sentence) {
        responseText += `**One-line Summary:** ${summaryObj.one_sentence}\n\n`;
      }
      
      if (summaryObj.key_insights && Array.isArray(summaryObj.key_insights)) {
        responseText += `**Key Insights:**\n`;
        summaryObj.key_insights.forEach((insight: string, idx: number) => {
          responseText += `${idx + 1}. ${insight}\n`;
        });
        responseText += '\n';
      }
      
      if (summaryObj.main_topics && Array.isArray(summaryObj.main_topics)) {
        responseText += `**Main Topics:** ${summaryObj.main_topics.join(', ')}\n\n`;
      }
      
      if (summaryObj.actionable_takeaways && Array.isArray(summaryObj.actionable_takeaways)) {
        responseText += `**Actionable Takeaways:**\n`;
        summaryObj.actionable_takeaways.forEach((takeaway: string, idx: number) => {
          responseText += `${idx + 1}. ${takeaway}\n`;
        });
        responseText += '\n';
      }
    }
    
    // Include full text content info and preview
    if (content.rawText) {
      const wordCount = content.rawText.split(/\s+/).length;
      responseText += `## Full Content\n`;
      responseText += `**Word Count:** ${wordCount.toLocaleString()} words\n`;
      
      // Show a reasonable preview (500 chars is about 100 tokens)
      responseText += `**Preview (first 500 chars):**\n`;
      responseText += `${content.rawText.slice(0, 500)}...\n\n`;
      
      if (content.tokenCount && content.tokenCount > 10000) {
        responseText += `⚠️ **Note:** The complete ${content.contentType} content (${wordCount.toLocaleString()} words, ~${content.tokenCount.toLocaleString()} tokens) is available in the data field.\n`;
        responseText += `This is a large amount of content that will consume significant context if fully processed.\n`;
      } else {
        responseText += `*Note: Complete content is available in the data field for analysis.*\n`;
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: content, // Full content including complete rawText
    };
  },
};