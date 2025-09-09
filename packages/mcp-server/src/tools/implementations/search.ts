import { z } from "zod";
import { Tool } from "../types.js";
import { generateTokenWarning, TOKEN_THRESHOLDS, CONTEXT_MANAGEMENT_INSTRUCTIONS } from "../utils/context-warnings.js";

export const searchContentTool: Tool = {
  name: "search_content",
  description: "Advanced search using vector embeddings, full-text, or hybrid search. Leverages semantic similarity for concept-based matching beyond keywords.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (natural language works best for semantic search)",
      },
      searchMode: {
        type: "string",
        enum: ["smart", "semantic", "hybrid", "any", "all", "phrase"],
        description: "Search mode: 'smart' (auto-select best), 'semantic' (vector embeddings), 'hybrid' (combined), 'any' (OR), 'all' (AND), 'phrase' (exact)",
        default: "smart",
      },
      fuzzyMatch: {
        type: "boolean",
        description: "Enable fuzzy/typo-tolerant matching",
        default: true,
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Filter by tags",
      },
      limit: {
        type: "number",
        description: "Maximum results (default: 10)",
        default: 10,
      },
      includeFullContent: {
        type: "boolean",
        description: "Include full text (WARNING: May consume 10k-100k+ tokens)",
        default: false,
      },
      acceptLargeContent: {
        type: "boolean",
        description: "Accept large content results (>50k tokens total) without warning",
        default: false,
      },
      contentTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ["youtube", "x_twitter", "reddit", "article", "pdf"],
        },
        description: "Filter by content types",
      },
      dateFrom: {
        type: "string",
        description: "Content saved after this date (ISO 8601)",
      },
      dateTo: {
        type: "string",
        description: "Content saved before this date (ISO 8601)",
      },
      excludeDomains: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Domains to exclude",
      },
      showRelevanceExplanation: {
        type: "boolean",
        description: "Show why each result matched",
        default: true,
      },
    },
    required: ["query"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      query: z.string(),
      searchMode: z.enum(["smart", "semantic", "hybrid", "any", "all", "phrase"]).optional().default("smart"),
      fuzzyMatch: z.boolean().optional().default(true),
      tags: z.array(z.string()).optional(),
      limit: z.number().optional().default(10),
      includeFullContent: z.boolean().optional().default(false),
      acceptLargeContent: z.boolean().optional().default(false),
      contentTypes: z.array(z.enum(["youtube", "x_twitter", "reddit", "article", "pdf"])).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      excludeDomains: z.array(z.string()).optional(),
      showRelevanceExplanation: z.boolean().optional().default(true),
    });
    const params = schema.parse(args);
    
    // Enhance search query based on mode
    let enhancedQuery = params.query;
    if (params.searchMode === "any" && !params.query.includes("OR")) {
      // Convert space-separated terms to OR query for broader matching
      const terms = params.query.split(/\s+/).filter(t => t.length > 2);
      if (terms.length > 1) {
        enhancedQuery = terms.join(" OR ");
      }
    }
    
    // Map the searchMode to options that the client understands
    const searchOptions: any = {
      tags: params.tags,
      limit: params.limit,
      includeFullContent: params.includeFullContent,
      contentTypes: params.contentTypes,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      excludeDomains: params.excludeDomains,
      fuzzyMatch: params.fuzzyMatch,
      enableConceptExpansion: params.fuzzyMatch,
    };
    
    // Add searchMode if it's a legacy mode (any, all, phrase)
    if (params.searchMode === "any" || params.searchMode === "all" || params.searchMode === "phrase") {
      searchOptions.searchMode = params.searchMode;
    } else if (params.searchMode === "semantic") {
      searchOptions.enableConceptExpansion = true;
    }
    
    const results = await client.searchContent(enhancedQuery, searchOptions);
    
    // Calculate total token count if including full content
    let totalTokens = 0;
    if (params.includeFullContent && results.length > 0) {
      totalTokens = results.reduce((sum: number, item: any) => {
        return sum + (item.tokenCount || 0);
      }, 0);
      
      // Check if we need to warn about large content
      if (totalTokens > TOKEN_THRESHOLDS.HUGE && !params.acceptLargeContent) {
        // Return warning instead of full results
        let warningText = `# ⚠️ Large Content Warning\n\n`;
        warningText += `Your search found ${results.length} results with ~${totalTokens.toLocaleString()} total tokens.\n`;
        warningText += `This exceeds safe context limits.\n\n`;
        
        warningText += `## Options:\n`;
        warningText += `1. **View summaries only** - Remove \`includeFullContent\` flag\n`;
        warningText += `2. **Limit results** - Add \`limit: 5\` to get fewer results\n`;
        warningText += `3. **Filter more** - Add content type or date filters\n`;
        warningText += `4. **Accept anyway** - Re-run with \`acceptLargeContent: true\`\n\n`;
        
        warningText += `## Search Preview (summaries only):\n`;
        warningText += `Found ${results.length} results matching "${params.query}"\n\n`;
        
        // Show first 3 results as preview
        results.slice(0, 3).forEach((result: any, idx: number) => {
          warningText += `**${idx + 1}. ${result.title || 'Untitled'}**\n`;
          if (result.summary) {
            const summaryText = typeof result.summary === 'string' 
              ? result.summary 
              : result.summary.one_sentence || result.summary.text;
            warningText += `${summaryText}\n\n`;
          }
        });
        
        return {
          content: [
            {
              type: "text",
              text: warningText,
            },
          ],
          data: {
            warning: "Large content - requires confirmation",
            totalTokens: totalTokens,
            resultCount: results.length,
            query: params.query,
          },
        };
      }
    }
    
    // Format response with visual indicators
    let responseText = `# 🔍 Search Results: "${params.query}"\n`;
    
    // Better mode descriptions
    const modeDescriptions: Record<string, string> = {
      smart: "🧠 Smart (auto-selecting best strategy)",
      semantic: "🎯 Semantic (vector embeddings for concept matching)",
      hybrid: "🔀 Hybrid (combining vector + keyword search)",
      any: "📝 Any match (OR logic)",
      all: "✅ All match (AND logic)",
      phrase: "💬 Exact phrase"
    };
    
    responseText += `**Mode:** ${modeDescriptions[params.searchMode] || params.searchMode.toUpperCase()}\n`;
    responseText += `**Found:** ${results.length} results`;
    
    // Show active filters
    const filters = [];
    if (params.tags?.length) filters.push(`📌 tags: ${params.tags.join(", ")}`);
    if (params.contentTypes?.length) filters.push(`📁 types: ${params.contentTypes.join(", ")}`);
    if (params.dateFrom || params.dateTo) filters.push(`📅 date range`);
    if (params.excludeDomains?.length) filters.push(`🚫 excluded: ${params.excludeDomains.join(", ")}`);
    
    if (filters.length > 0) {
      responseText += `\n**Filters:** ${filters.join(" | ")}`;
    }
    
    if (params.includeFullContent) {
      const warningMsg = generateTokenWarning(totalTokens, "search results", results.length);
      if (warningMsg) {
        responseText += warningMsg;
      } else {
        responseText += `\n✅ **Full content included** (${totalTokens.toLocaleString()} tokens)`;
      }
    }
    
    responseText += `\n\n`;
    
    if (results.length > 0) {
      // Add search suggestions if no perfect matches
      if (results.length < 3) {
        responseText += `💡 **Tip:** Try broader search with 'any' mode or disable filters for more results\n\n`;
      }
      
      results.forEach((result: any, idx: number) => {
        // Visual indicators for content type
        const typeIcons: Record<string, string> = {
          youtube: "📺",
          x_twitter: "𝕏",
          reddit: "🔗",
          article: "📄",
          pdf: "📑"
        };
        const typeIcon = typeIcons[result.contentType] || "📄";
        
        // Relevance indicator
        let relevanceIcon = "";
        if (result.relevanceScore) {
          if (result.relevanceScore > 0.8) relevanceIcon = "🎯";
          else if (result.relevanceScore > 0.6) relevanceIcon = "✅";
          else if (result.relevanceScore > 0.4) relevanceIcon = "➡️";
        }
        
        responseText += `## ${idx + 1}. ${typeIcon} ${result.title || 'Untitled'} ${relevanceIcon}\n`;
        responseText += `**ID:** \`${result.id}\`\n`;
        responseText += `**URL:** ${result.url}\n`;
        
        // Show relevance explanation if available
        if (params.showRelevanceExplanation) {
          if (result.matchReason && Array.isArray(result.matchReason)) {
            responseText += `**Why matched:** Matched in ${result.matchReason.join(", ")}\n`;
          } else if (result.relevanceScore) {
            const percentage = (result.relevanceScore * 100).toFixed(0);
            responseText += `**Relevance:** ${percentage}% match\n`;
          }
        }
        
        // Content size indicator with better formatting
        if (result.tokenCount) {
          const sizeIcon = result.tokenCount > 50000 ? "🚨" : 
                         result.tokenCount > 10000 ? "⚠️" : 
                         result.tokenCount > 5000 ? "📊" : "📝";
          responseText += `**Size:** ${sizeIcon} ~${result.tokenCount.toLocaleString()} tokens`;
          if (params.includeFullContent) {
            responseText += ` (full content included)`;
          }
          responseText += `\n`;
        }
        
        // Tags with better formatting
        if (result.tags && result.tags.length > 0) {
          responseText += `**Tags:** ${result.tags.map((t: string) => `\`${t}\``).join(' ')}\n`;
        }
        
        // Summary section with structure
        if (result.summary) {
          const summaryObj = typeof result.summary === 'string' 
            ? { text: result.summary } 
            : result.summary;
          
          if (summaryObj.one_sentence) {
            responseText += `\n📝 **Summary:** ${summaryObj.one_sentence}\n`;
          }
          
          // Key insights with bullets
          if (summaryObj.key_insights && Array.isArray(summaryObj.key_insights) && summaryObj.key_insights.length > 0) {
            responseText += `\n💡 **Key Insights:**\n`;
            summaryObj.key_insights.slice(0, 3).forEach((insight: string) => {
              responseText += `  • ${insight}\n`;
            });
          }
          
          // Actionable takeaways
          if (summaryObj.actionable_takeaways && Array.isArray(summaryObj.actionable_takeaways) && summaryObj.actionable_takeaways.length > 0) {
            responseText += `\n🎯 **Actions:**\n`;
            summaryObj.actionable_takeaways.slice(0, 2).forEach((action: string) => {
              responseText += `  → ${action}\n`;
            });
          }
        }
        
        responseText += '\n---\n\n';
      });
      
      // Smart token usage summary
      if (!params.includeFullContent) {
        let totalAvailable = 0;
        results.forEach((r: any) => {
          if (r.tokenCount) totalAvailable += r.tokenCount;
        });
        
        if (totalAvailable > 0) {
          responseText += `\n📊 **Content Overview:**\n`;
          responseText += `- Showing: Summaries and metadata (minimal tokens)\n`;
          responseText += `- Available: ~${totalAvailable.toLocaleString()} tokens of full content\n`;
          responseText += `- To access: Use \`get_content_details\` for specific items\n`;
        }
      }
      
      // Search quality feedback
      if (results.length === params.limit) {
        responseText += `\n💡 **Note:** Showing top ${params.limit} results. More may be available.\n`;
      }
      
    } else {
      // No results - provide helpful suggestions
      responseText += "## No Results Found 😔\n\n";
      responseText += "**Try these approaches:**\n";
      responseText += "1. 🔄 Switch to `searchMode: 'any'` for broader matching\n";
      responseText += "2. ✏️ Check spelling or use simpler terms\n";
      responseText += "3. 🎯 Remove filters (dates, types, domains)\n";
      responseText += "4. 🔍 Use more general keywords\n";
      
      // Suggest alternative queries
      const terms = params.query.split(/\s+/);
      if (terms.length > 1) {
        responseText += `\n**Alternative queries:**\n`;
        responseText += `- "${terms[0]}" (single term)\n`;
        responseText += `- "${terms.slice(0, 2).join(' ')}" (first two terms)\n`;
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: results,
    };
  },
};