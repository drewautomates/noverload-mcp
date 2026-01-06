import { z } from "zod";
import { Tool } from "../types.js";
import { generateTokenWarning, generatePreviewResponse, TOKEN_THRESHOLDS } from "../utils/context-warnings.js";

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
      acceptLargeContent: {
        type: "boolean",
        description: "Accept large content (>50k tokens) without warning",
        default: false,
      },
    },
    required: ["contentId"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string(),
      acceptLargeContent: z.boolean().optional().default(false),
    });
    const { contentId, acceptLargeContent } = schema.parse(args);
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
      // Handle both string and object summaries
      if (typeof content.summary === 'string') {
        // Plain string summary - display it directly
        responseText += `**Summary:** ${content.summary}\n\n`;
      } else {
        // Structured summary object
        const summaryObj = content.summary;

        if (summaryObj.one_sentence) {
          responseText += `**One-line Summary:** ${summaryObj.one_sentence}\n\n`;
        }

        // Also check for 'text' field (common alternative)
        if (summaryObj.text && !summaryObj.one_sentence) {
          responseText += `**Summary:** ${summaryObj.text}\n\n`;
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
    }

    // Show key insights from the API if available (separate from summary object)
    if (content.keyInsights && Array.isArray(content.keyInsights) && content.keyInsights.length > 0) {
      responseText += `**Key Insights:**\n`;
      content.keyInsights.forEach((insight: string, idx: number) => {
        responseText += `${idx + 1}. ${insight}\n`;
      });
      responseText += '\n';
    }
    
    // Check if content is large and needs warning
    if (content.tokenCount && content.tokenCount > TOKEN_THRESHOLDS.HUGE && !acceptLargeContent) {
      // Return preview with warning instead of full content
      return {
        content: [
          {
            type: "text",
            text: generatePreviewResponse(content, content.tokenCount, "content retrieval"),
          },
        ],
        data: {
          warning: "Large content - requires confirmation",
          tokenCount: content.tokenCount,
          contentId: content.id,
          preview: {
            title: content.title,
            contentType: content.contentType,
            url: content.url,
            summary: content.summary,
          },
        },
      };
    }
    
    // Include full text content
    if (content.rawText) {
      const wordCount = content.rawText.split(/\s+/).length;
      responseText += `## Full Content\n`;
      responseText += `**Word Count:** ${wordCount.toLocaleString()} words\n`;
      
      // Add appropriate warning based on size
      const tokenWarning = generateTokenWarning(
        content.tokenCount || wordCount * 1.3, // Estimate if no token count
        "content"
      );
      if (tokenWarning) {
        responseText += tokenWarning + '\n';
      }
      
      // Include the full content for LLM context
      responseText += `\n### Complete Text:\n\n`;
      responseText += content.rawText;
      responseText += '\n\n';
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