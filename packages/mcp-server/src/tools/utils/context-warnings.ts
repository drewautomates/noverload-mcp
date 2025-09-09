import { Tool } from "../types.js";

/**
 * Token thresholds for warnings
 */
export const TOKEN_THRESHOLDS = {
  SMALL: 1000,      // No warning needed
  MEDIUM: 5000,     // Mild warning
  LARGE: 10000,     // Strong warning  
  HUGE: 50000,      // Critical warning - requires confirmation
  MASSIVE: 100000,  // Extreme warning - strongly discourage
} as const;

/**
 * Get warning level based on token count
 */
export function getTokenWarningLevel(tokens: number): "none" | "mild" | "strong" | "critical" | "extreme" {
  if (tokens < TOKEN_THRESHOLDS.SMALL) return "none";
  if (tokens < TOKEN_THRESHOLDS.MEDIUM) return "mild";
  if (tokens < TOKEN_THRESHOLDS.LARGE) return "strong";
  if (tokens < TOKEN_THRESHOLDS.HUGE) return "critical";
  return "extreme";
}

/**
 * Generate warning message for token consumption
 */
export function generateTokenWarning(
  tokens: number,
  operation: string,
  itemCount?: number
): string {
  const level = getTokenWarningLevel(tokens);
  
  if (level === "none") return "";
  
  const itemsText = itemCount ? ` for ${itemCount} items` : "";
  
  switch (level) {
    case "mild":
      return `\n📊 **Note:** This ${operation}${itemsText} will use ~${tokens.toLocaleString()} tokens.`;
      
    case "strong":
      return `\n⚠️ **Warning:** This ${operation}${itemsText} will consume ~${tokens.toLocaleString()} tokens (significant context usage).`;
      
    case "critical":
      return `\n🚨 **Critical Warning:** This ${operation}${itemsText} will consume ~${tokens.toLocaleString()} tokens!\n` +
             `This is a very large amount that may use up most of your context window.\n` +
             `Consider:\n` +
             `• Limiting your search/request to fewer items\n` +
             `• Using specific filters to reduce results\n` +
             `• Requesting content without full text (summaries only)`;
      
    case "extreme":
      return `\n🛑 **EXTREME WARNING:** This ${operation}${itemsText} would consume ~${tokens.toLocaleString()} tokens!\n` +
             `This exceeds typical LLM context windows and is strongly discouraged.\n` +
             `**Recommendations:**\n` +
             `• Break down your request into smaller chunks\n` +
             `• Use more specific search queries\n` +
             `• Request summaries instead of full content\n` +
             `• Use the batch_get_content tool with specific IDs`;
  }
}

/**
 * Generate a preview response when content is too large
 */
export function generatePreviewResponse(
  content: any,
  actualTokens: number,
  operation: string
): string {
  let response = `# ⚠️ Large Content Warning\n\n`;
  response += `The ${operation} would return ~${actualTokens.toLocaleString()} tokens.\n\n`;
  
  response += `## Options:\n`;
  response += `1. **Get summary only** - Use without \`includeFullContent\` flag\n`;
  response += `2. **Get specific sections** - Use the \`smart_sections\` tool\n`;
  response += `3. **Accept full content** - Re-run with \`acceptLargeContent: true\` parameter\n\n`;
  
  response += `## Content Preview:\n`;
  response += `**Title:** ${content.title || 'Untitled'}\n`;
  response += `**Type:** ${content.contentType}\n`;
  response += `**URL:** ${content.url}\n`;
  
  if (content.summary) {
    const summaryObj = typeof content.summary === 'string' 
      ? { text: content.summary } 
      : content.summary;
    
    if (summaryObj.one_sentence) {
      response += `\n**Summary:** ${summaryObj.one_sentence}\n`;
    }
  }
  
  return response;
}

/**
 * Instructions for LLMs on how to handle large content requests
 */
export const CONTEXT_MANAGEMENT_INSTRUCTIONS = `
## Context Management Instructions for LLMs

When users request content from Noverload, be mindful of token consumption:

### Before Returning Large Content:

1. **Check Token Count**: If content exceeds 10,000 tokens, warn the user
2. **Suggest Alternatives**: 
   - Use summaries instead of full text
   - Use smart_sections for specific parts
   - Filter searches more narrowly
3. **Require Confirmation**: For content over 50,000 tokens, ask for explicit confirmation

### Best Practices:

- Start with summaries and metadata
- Only fetch full content when specifically needed
- Use batch operations efficiently
- Guide users to more targeted queries

### Warning Thresholds:

- < 1,000 tokens: No warning needed
- 1,000-5,000 tokens: Note the size
- 5,000-10,000 tokens: Mild warning
- 10,000-50,000 tokens: Strong warning with alternatives
- > 50,000 tokens: Require explicit confirmation

### Example User Interaction:

User: "Show me all my saved content about AI"
Assistant: "I found 45 items about AI. Getting full content for all would use ~250,000 tokens. 
Would you like to:
1. See summaries only (recommended)
2. Filter to specific types (YouTube, articles, etc.)
3. Search for a more specific AI topic"
`;