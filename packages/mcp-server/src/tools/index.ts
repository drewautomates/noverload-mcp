import { z } from "zod";
import { NoverloadClient } from "../client.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  modifies: boolean;
  handler: (client: NoverloadClient, args: unknown) => Promise<{ content: Array<{ type: string; text: string }>, data?: unknown }>;
}

export const tools: Tool[] = [
  {
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
  },
  {
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
  },
  {
    name: "search_content",
    description: "Advanced search with OR/ANY logic, fuzzy matching, and smart filters. Supports multiple search modes, content type filtering, date ranges, and relevance explanations.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (supports 'term1 OR term2' for any match, quotes for exact phrases)",
        },
        searchMode: {
          type: "string",
          enum: ["any", "all", "phrase"],
          description: "Search logic: 'any' (OR logic), 'all' (AND logic), 'phrase' (exact phrase)",
          default: "any",
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
          description: "Include full text (WARNING: 10k-100k+ tokens)",
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
        searchMode: z.enum(["any", "all", "phrase"]).optional().default("any"),
        fuzzyMatch: z.boolean().optional().default(true),
        tags: z.array(z.string()).optional(),
        limit: z.number().optional().default(10),
        includeFullContent: z.boolean().optional().default(false),
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
      
      const results = await client.searchContent(enhancedQuery, {
        ...params,
        enableConceptExpansion: params.fuzzyMatch, // Use fuzzy matching as concept expansion
      });
      
      // Format response with visual indicators
      let responseText = `# 🔍 Search Results: "${params.query}"\n`;
      responseText += `**Mode:** ${params.searchMode.toUpperCase()}${params.fuzzyMatch ? " with fuzzy matching" : ""}\n`;
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
        responseText += `\n⚠️ **Full content included** - consuming significant tokens`;
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
  },
  {
    name: "save_content",
    description: "Save a new URL to Noverload for processing",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to save (YouTube, X/Twitter, Reddit, article, or PDF)",
        },
      },
      required: ["url"],
    },
    modifies: true,
    handler: async (client, args) => {
      const schema = z.object({
        url: z.string().url(),
      });
      const { url } = schema.parse(args);
      const content = await client.saveContent(url);
      return {
        content: [
          {
            type: "text",
            text: content.title ? `Saved: ${content.title}` : `Saved content from: ${new URL(url).hostname}`,
          },
        ],
        data: content,
      };
    },
  },
  {
    name: "list_actions",
    description: "List action items extracted from saved content",
    inputSchema: {
      type: "object",
      properties: {
        contentId: {
          type: "string",
          description: "Filter by content ID",
        },
        goalId: {
          type: "string",
          description: "Filter by goal ID",
        },
        completed: {
          type: "boolean",
          description: "Filter by completion status",
        },
      },
    },
    modifies: false,
    handler: async (client, args) => {
      const schema = z.object({
        contentId: z.string().optional(),
        goalId: z.string().optional(),
        completed: z.boolean().optional(),
      });
      const params = schema.parse(args);
      const actions = await client.listActions(params);
      return {
        content: [
          {
            type: "text",
            text: `Found ${actions.length} actions`,
          },
        ],
        data: actions,
      };
    },
  },
  {
    name: "complete_action",
    description: "Mark an action item as completed",
    inputSchema: {
      type: "object",
      properties: {
        actionId: {
          type: "string",
          description: "The ID of the action to complete",
        },
      },
      required: ["actionId"],
    },
    modifies: true,
    handler: async (client, args) => {
      const schema = z.object({
        actionId: z.string(),
      });
      const { actionId } = schema.parse(args);
      const action = await client.completeAction(actionId);
      return {
        content: [
          {
            type: "text",
            text: `Completed action: ${action.title}`,
          },
        ],
        data: action,
      };
    },
  },
  {
    name: "list_goals",
    description: "List user's goals (Health, Wealth, Relationships)",
    inputSchema: {
      type: "object",
      properties: {},
    },
    modifies: false,
    handler: async (client) => {
      const goals = await client.listGoals();
      return {
        content: [
          {
            type: "text",
            text: `Found ${goals.length} goals`,
          },
        ],
        data: goals,
      };
    },
  },
  {
    name: "estimate_search_tokens",
    description: "Estimate token usage before performing a search. Helps manage context window and API costs.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to estimate",
        },
        limit: {
          type: "number",
          description: "Number of results to estimate for",
          default: 10,
        },
      },
      required: ["query"],
    },
    modifies: false,
    handler: async (client, args) => {
      const schema = z.object({
        query: z.string(),
        limit: z.number().optional().default(10),
      });
      const params = schema.parse(args);
      const estimate = await client.estimateSearchTokens(params.query, params.limit);
      
      let responseText = `# Token Estimate for: "${params.query}"\n\n`;
      responseText += `**Total Estimated Tokens:** ${estimate.totals?.estimatedTokens || 0}\n`;
      responseText += `**Recommendation:** ${estimate.recommendation || "Unknown"}\n\n`;
      
      if (estimate.costEstimate) {
        responseText += `## Estimated Costs\n`;
        responseText += `- GPT-4: ${estimate.costEstimate.gpt4}\n`;
        responseText += `- GPT-3.5: ${estimate.costEstimate.gpt35}\n`;
        responseText += `- Claude 3: ${estimate.costEstimate.claude3}\n\n`;
      }
      
      if (estimate.estimates && estimate.estimates.length > 0) {
        responseText += `## Content Breakdown\n`;
        estimate.estimates.forEach((item: any, idx: number) => {
          responseText += `${idx + 1}. ${item.title || "Untitled"} - ${item.estimatedTokens} tokens\n`;
        });
      }
      
      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        data: estimate,
      };
    },
  },
  {
    name: "synthesize_content",
    description: "Analyze multiple content sources to generate actionable insights, find patterns, connections, and contradictions. Creates structured synthesis with timeline, next steps, and confidence scores.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Topic or question to synthesize insights about",
        },
        contentIds: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Specific content IDs to analyze (optional, otherwise uses search)",
        },
        synthesisMode: {
          type: "string",
          enum: ["overview", "deep", "actionable", "comparison"],
          description: "Type of synthesis to perform (default: actionable)",
          default: "actionable",
        },
        findContradictions: {
          type: "boolean",
          description: "Look for contradictions between sources",
          default: false,
        },
        findConnections: {
          type: "boolean",
          description: "Find connections and patterns across sources",
          default: true,
        },
        maxSources: {
          type: "number",
          description: "Maximum number of sources to analyze",
          default: 10,
        },
      },
      required: ["query"],
    },
    modifies: false,
    handler: async (client, args) => {
      const schema = z.object({
        query: z.string(),
        contentIds: z.array(z.string()).optional(),
        synthesisMode: z.enum(["overview", "deep", "actionable", "comparison"]).optional().default("actionable"),
        findContradictions: z.boolean().optional().default(false),
        findConnections: z.boolean().optional().default(true),
        maxSources: z.number().optional().default(10),
      });
      const params = schema.parse(args);
      const result = await client.synthesizeContent(params);
      
      // Check if it's the new enhanced format
      const synthesis = result.synthesis || result;
      const metadata = result.metadata;
      
      let responseText = `# 🎯 Synthesis: "${params.query}"\n\n`;
      
      // Executive Summary
      if (synthesis.executiveSummary) {
        responseText += `## 📋 Executive Summary\n${synthesis.executiveSummary}\n\n`;
      }
      
      // Confidence Scores
      if (synthesis.confidence) {
        responseText += `## 📊 Confidence Levels\n`;
        responseText += `- **Overall:** ${Math.round(synthesis.confidence.overall * 100)}%\n`;
        responseText += `- **Data Quality:** ${Math.round(synthesis.confidence.dataQuality * 100)}%\n`;
        responseText += `- **Coverage:** ${Math.round(synthesis.confidence.coverage * 100)}%\n\n`;
      }
      
      // Actionable Insights
      if (synthesis.actionableInsights && synthesis.actionableInsights.length > 0) {
        responseText += `## 💡 Actionable Insights\n`;
        synthesis.actionableInsights.forEach((insight: any) => {
          const priorityIcon = insight.priority === "high" ? "🔴" : insight.priority === "medium" ? "🟡" : "🟢";
          responseText += `\n### ${priorityIcon} ${insight.insight}\n`;
          responseText += `**Category:** ${insight.category} | **Confidence:** ${Math.round(insight.confidence * 100)}%\n`;
          if (insight.supportingEvidence && insight.supportingEvidence.length > 0) {
            responseText += `**Evidence:**\n`;
            insight.supportingEvidence.slice(0, 3).forEach((evidence: string) => {
              responseText += `- ${evidence}\n`;
            });
          }
        });
        responseText += `\n`;
      }
      
      // Key Themes
      if (synthesis.keyThemes && synthesis.keyThemes.length > 0) {
        responseText += `## 🎨 Key Themes\n`;
        synthesis.keyThemes.forEach((theme: any) => {
          responseText += `\n### ${theme.theme} (${theme.frequency} sources)\n`;
          responseText += `${theme.insight}\n`;
        });
        responseText += `\n`;
      }
      
      // Timeline
      if (synthesis.timeline && synthesis.timeline.length > 0) {
        responseText += `## ⏱️ Suggested Timeline\n`;
        synthesis.timeline.forEach((phase: any, idx: number) => {
          responseText += `\n### Phase ${idx + 1}: ${phase.phase} (${phase.duration})\n`;
          if (phase.activities && phase.activities.length > 0) {
            phase.activities.forEach((activity: string) => {
              responseText += `- ${activity}\n`;
            });
          }
        });
        responseText += `\n`;
      }
      
      // Connections
      if (synthesis.connections && synthesis.connections.length > 0) {
        responseText += `## 🔗 Connections & Patterns\n`;
        synthesis.connections.forEach((conn: any) => {
          responseText += `- **${conn.pattern}**: ${conn.implication}\n`;
        });
        responseText += `\n`;
      }
      
      // Contradictions
      if (synthesis.contradictions && synthesis.contradictions.length > 0) {
        responseText += `## ⚡ Contradictions & Different Viewpoints\n`;
        synthesis.contradictions.forEach((contra: any) => {
          responseText += `\n### ${contra.topic}\n`;
          contra.viewpoints.forEach((vp: any) => {
            responseText += `- **${vp.position}**: ${vp.argument}\n`;
          });
          if (contra.resolution) {
            responseText += `**Resolution:** ${contra.resolution}\n`;
          }
        });
        responseText += `\n`;
      }
      
      // Knowledge Gaps
      if (synthesis.knowledgeGaps && synthesis.knowledgeGaps.length > 0) {
        responseText += `## 🔍 Knowledge Gaps\n`;
        responseText += `Missing information that could strengthen your understanding:\n`;
        synthesis.knowledgeGaps.forEach((gap: string) => {
          responseText += `- ${gap}\n`;
        });
        responseText += `\n`;
      }
      
      // Recommended Next Steps
      if (synthesis.recommendedNextSteps && synthesis.recommendedNextSteps.length > 0) {
        responseText += `## 🚀 Recommended Next Steps\n`;
        synthesis.recommendedNextSteps.forEach((step: string, idx: number) => {
          responseText += `${idx + 1}. ${step}\n`;
        });
        responseText += `\n`;
      }
      
      // Metadata
      if (metadata) {
        responseText += `---\n`;
        responseText += `*Analyzed ${metadata.sourceCount} sources in ${metadata.mode} mode*\n`;
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
  },
  {
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
          responseText += `**Type:** ${item.type} | **URL:** ${item.url}\n`;
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
  },
  {
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
  },
];