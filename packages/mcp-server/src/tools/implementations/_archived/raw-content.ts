import { z } from "zod";
import { Tool } from "../types.js";
import { chunkContent, detectSections } from "../helpers/content-processing.js";

export const getRawContentTool: Tool = {
  name: "get_raw_content",
  description: "Access full raw text of saved content with smart chunking for large documents. Requires confirmation for content >10k tokens. Returns complete unprocessed text or intelligently chunked sections.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "The ID of the content to retrieve raw text for",
      },
      format: {
        type: "string",
        enum: ["full", "chunks", "sections"],
        description: "Format: 'full' (complete text), 'chunks' (semantic chunks), 'sections' (logical sections)",
        default: "chunks",
      },
      maxTokens: {
        type: "number",
        description: "Maximum tokens to return (only for chunks/sections format)",
        default: 50000,
      },
      chunkSize: {
        type: "number",
        description: "Target size for each chunk in tokens (for chunks format)",
        default: 4000,
      },
      includeMetadata: {
        type: "boolean",
        description: "Include metadata about sections/chunks",
        default: true,
      },
      confirmLargeContent: {
        type: "boolean",
        description: "Confirm retrieval of large content (>10k tokens)",
        default: false,
      },
    },
    required: ["contentId"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string(),
      format: z.enum(["full", "chunks", "sections"]).optional().default("chunks"),
      maxTokens: z.number().optional().default(50000),
      chunkSize: z.number().optional().default(4000),
      includeMetadata: z.boolean().optional().default(true),
      confirmLargeContent: z.boolean().optional().default(false),
    });
    const params = schema.parse(args);
    
    // First get content metadata to check size
    const content = await client.getContent(params.contentId);
    
    if (!content.rawText) {
      // Try to get raw content through v2 API with enrichment
      const enrichedResult = await client.getEnrichedContent([params.contentId], true);
      
      if (!enrichedResult || enrichedResult.length === 0 || !enrichedResult[0].rawText) {
        return {
          content: [
            {
              type: "text",
              text: `No raw text available for content ID: ${params.contentId}. Content may still be processing or does not contain extractable text.`,
            },
          ],
          data: null,
        };
      }
      
      // Use the enriched content
      content.rawText = enrichedResult[0].rawText;
      content.tokenCount = enrichedResult[0].tokenCount;
    }
    
    const wordCount = content.rawText ? content.rawText.split(/\s+/).length : 0;
    const estimatedTokens = content.tokenCount || Math.ceil(wordCount * 1.3);
    
    // Check if confirmation is needed for large content
    if (params.format === "full" && estimatedTokens > 10000 && !params.confirmLargeContent) {
      let warningText = `# ⚠️ Large Content Warning\n\n`;
      warningText += `**Content:** ${content.title || 'Untitled'}\n`;
      warningText += `**Size:** ${wordCount.toLocaleString()} words (~${estimatedTokens.toLocaleString()} tokens)\n\n`;
      
      if (estimatedTokens > 100000) {
        warningText += `## 🚨 CRITICAL: Extremely Large Content\n`;
        warningText += `This content contains ${estimatedTokens.toLocaleString()} tokens and will **exceed most LLM context windows**.\n\n`;
        warningText += `**Recommendations:**\n`;
        warningText += `1. Use format='chunks' to process in smaller pieces\n`;
        warningText += `2. Use format='sections' to get logical divisions\n`;
        warningText += `3. Use search_content to find specific information\n`;
        warningText += `4. Use synthesize_content to get key insights without full text\n\n`;
      } else if (estimatedTokens > 50000) {
        warningText += `## ⚠️ Very Large Content\n`;
        warningText += `This content contains ${estimatedTokens.toLocaleString()} tokens and will use **most of your context window**.\n\n`;
        warningText += `**Consider:**\n`;
        warningText += `- Using format='chunks' for manageable pieces\n`;
        warningText += `- Using search or synthesis tools instead\n\n`;
      } else {
        warningText += `## Large Content Notice\n`;
        warningText += `This content will use ${estimatedTokens.toLocaleString()} tokens of your context.\n\n`;
      }
      
      warningText += `**To proceed with full text retrieval:**\n`;
      warningText += `Call get_raw_content again with:\n`;
      warningText += `- contentId: "${params.contentId}"\n`;
      warningText += `- format: "full"\n`;
      warningText += `- confirmLargeContent: true\n\n`;
      
      warningText += `**Alternative approaches:**\n`;
      warningText += `- format: "chunks" - Get content in ${Math.ceil(estimatedTokens / params.chunkSize)} chunks of ~${params.chunkSize} tokens\n`;
      warningText += `- format: "sections" - Get logical sections with headers\n`;
      
      return {
        content: [
          {
            type: "text",
            text: warningText,
          },
        ],
        data: {
          requiresConfirmation: true,
          contentId: params.contentId,
          title: content.title,
          estimatedTokens,
          suggestedFormat: estimatedTokens > 50000 ? "chunks" : "sections",
          chunkCount: Math.ceil(estimatedTokens / params.chunkSize),
        },
      };
    }
    
    let responseText = `# Raw Content: ${content.title || 'Untitled'}\n\n`;
    responseText += `**Content Type:** ${content.contentType}\n`;
    responseText += `**URL:** ${content.url}\n`;
    responseText += `**Size:** ${wordCount.toLocaleString()} words (~${estimatedTokens.toLocaleString()} tokens)\n`;
    
    // Add appropriate warning based on size
    if (estimatedTokens > 50000 && params.format === "full") {
      responseText += `\n⚠️ **Large content confirmed** - Returning ${estimatedTokens.toLocaleString()} tokens\n\n`;
    }
    
    let resultData: any = {
      id: content.id,
      title: content.title,
      contentType: content.contentType,
      totalTokens: estimatedTokens,
      format: params.format,
    };
    
    if (params.format === "full") {
      // Return full text (with confirmation)
      responseText += `\n## Full Text Content\n\n`;
      // Actually include the content in the response
      responseText += content.rawText || "";
      responseText += `\n`;

      resultData.text = content.rawText;
      resultData.metadata = params.includeMetadata ? {
        wordCount,
        estimatedTokens,
        contentType: content.contentType,
        extractedAt: content.createdAt,
      } : undefined;
      
    } else if (params.format === "chunks") {
      // Smart chunking based on token size
      const chunks = chunkContent(content.rawText || "", params.chunkSize, params.maxTokens);
      
      responseText += `\n## Content Chunks\n`;
      responseText += `**Total Chunks:** ${chunks.length}\n`;
      responseText += `**Chunk Size:** ~${params.chunkSize} tokens each\n`;
      
      if (chunks.length * params.chunkSize > params.maxTokens) {
        responseText += `**Note:** Showing first ${chunks.length} chunks (limited by maxTokens: ${params.maxTokens})\n`;
      }
      responseText += `\n`;
      
      // Show chunk previews
      chunks.slice(0, 3).forEach((chunk, idx) => {
        responseText += `### Chunk ${idx + 1}/${chunks.length}\n`;
        responseText += `**Tokens:** ~${chunk.tokenCount}\n`;
        responseText += `**Preview:** ${chunk.text.slice(0, 200)}...\n\n`;
      });
      
      if (chunks.length > 3) {
        responseText += `*... and ${chunks.length - 3} more chunks*\n\n`;
      }
      
      responseText += `💡 **Tip:** To get a specific chunk, note the chunk index and request it directly.\n`;
      
      resultData.chunks = chunks;
      resultData.totalChunks = chunks.length;
      
    } else if (params.format === "sections") {
      // Logical section detection (headers, paragraphs, etc.)
      const sections = detectSections(content.rawText || "", content.contentType);
      
      responseText += `\n## Content Sections\n`;
      responseText += `**Total Sections:** ${sections.length}\n\n`;
      
      // Show section outline
      let totalSectionTokens = 0;
      sections.forEach((section, idx) => {
        responseText += `${idx + 1}. **${section.title || `Section ${idx + 1}`}**`;
        if (section.type) {
          responseText += ` (${section.type})`;
        }
        responseText += ` - ~${section.tokenCount} tokens\n`;
        totalSectionTokens += section.tokenCount;
        
        if (totalSectionTokens > params.maxTokens) {
          responseText += `   *[Exceeds maxTokens limit]*\n`;
        }
      });
      
      responseText += `\n*Full section content available in data field*\n`;
      
      resultData.sections = sections;
      resultData.totalSections = sections.length;
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: resultData,
    };
  },
};