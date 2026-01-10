import { z } from "zod";

export interface ClientConfig {
  accessToken: string;
  apiUrl: string;
  readOnly: boolean;
}

// Content types enum for reuse
export const ContentTypeEnum = z.enum(["youtube", "x_twitter", "reddit", "article", "pdf"]);
export const ContentStatusEnum = z.enum(["pending", "processing", "completed", "failed"]);

// Summary can be either a string or a structured object
// The API returns different formats depending on processing stage
export const SummaryObjectSchema = z.object({
  one_sentence: z.string().optional(),
  text: z.string().optional(),
  key_points: z.array(z.string()).optional(),
  actionable_takeaways: z.array(z.string()).optional(),
}).passthrough(); // Allow additional fields from API

export const SummarySchema = z.union([
  z.string(),
  SummaryObjectSchema,
]).nullable().optional();

// Processing metadata schema (flexible for API variations)
export const ProcessingMetadataSchema = z.object({
  processedAt: z.string().optional(),
  duration: z.number().optional(),
  model: z.string().optional(),
  version: z.string().optional(),
}).passthrough().nullable().optional();

// Schema definitions matching Noverload database
// Required fields will throw if missing - no silent defaults for critical data
export const ContentSchema = z.object({
  // Required fields - will throw if missing
  id: z.string().min(1, "Content ID is required"),
  url: z.string().min(1, "Content URL is required"),

  // Optional metadata - may not be present in API response
  userId: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),

  // Fields with API-behavior defaults (API typically provides these)
  contentType: ContentTypeEnum.optional().default("article"),
  status: ContentStatusEnum.optional().default("pending"),

  // Properly typed summary field
  summary: SummarySchema,
  keyInsights: z.array(z.string()).nullable().optional(),

  // Content data
  rawText: z.string().nullable().optional(),
  tokenCount: z.number().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  processingMetadata: ProcessingMetadataSchema,

  // Tags default to empty array (API convention)
  tags: z.array(z.string()).optional().default([]),

  // Timestamps - optional, no fabrication if missing
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ActionSchema = z.object({
  // Required fields
  id: z.string().min(1, "Action ID is required"),
  title: z.string().min(1, "Action title is required"),

  // Optional fields - no data fabrication
  contentId: z.string().optional(),
  goalId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).nullable().optional(),
  completed: z.boolean().optional().default(false),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const GoalSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.enum(["health", "wealth", "relationships"]),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isSystem: z.boolean(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  usageCount: z.number().optional().default(0),
});

export const TagsResponseSchema = z.object({
  success: z.boolean(),
  tags: z.array(TagSchema),
  grouped: z.object({
    system: z.array(TagSchema),
    custom: z.array(TagSchema),
  }).optional(),
  total: z.number(),
});

export const CreateTagResponseSchema = z.object({
  success: z.boolean(),
  tag: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    isSystem: z.boolean(),
    isNew: z.boolean().optional(),
  }),
  message: z.string().optional(),
});

export const AddTagsResponseSchema = z.object({
  success: z.boolean(),
  contentId: z.string(),
  addedTags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    created: z.boolean(),
  })),
  errors: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export const RemoveTagsResponseSchema = z.object({
  success: z.boolean(),
  contentId: z.string(),
  removedTags: z.array(z.string()),
  errors: z.array(z.string()).optional(),
  message: z.string().optional(),
});

// Swipe file response schemas
export const MarkSwipeFileResponseSchema = z.object({
  success: z.boolean(),
  contentId: z.string(),
  contentTitle: z.string().optional(),
  isSwipeFile: z.boolean(),
  analysisTriggered: z.boolean().optional(),
  analysisError: z.string().optional(),
  tagsAdded: z.array(z.object({
    name: z.string(),
    confidence: z.number(),
    reason: z.string(),
  })).optional(),
  totalTags: z.number().optional(),
  message: z.string().optional(),
});

export const UnmarkSwipeFileResponseSchema = z.object({
  success: z.boolean(),
  contentId: z.string(),
  contentTitle: z.string().optional(),
  isSwipeFile: z.boolean(),
  message: z.string().optional(),
});

export const SwipeFileStatusResponseSchema = z.object({
  success: z.boolean(),
  contentId: z.string(),
  contentTitle: z.string().optional(),
  isSwipeFile: z.boolean(),
  swipeFileTags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    confidenceScore: z.number().nullable(),
  })).optional(),
  totalSwipeFileTags: z.number().optional(),
});

export type Content = z.infer<typeof ContentSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type TagsResponse = z.infer<typeof TagsResponseSchema>;
export type CreateTagResponse = z.infer<typeof CreateTagResponseSchema>;
export type AddTagsResponse = z.infer<typeof AddTagsResponseSchema>;
export type RemoveTagsResponse = z.infer<typeof RemoveTagsResponseSchema>;
export type MarkSwipeFileResponse = z.infer<typeof MarkSwipeFileResponseSchema>;
export type UnmarkSwipeFileResponse = z.infer<typeof UnmarkSwipeFileResponseSchema>;
export type SwipeFileStatusResponse = z.infer<typeof SwipeFileStatusResponseSchema>;

export class NoverloadClient {
  private headers: Record<string, string>;

  constructor(private config: ClientConfig) {
    this.headers = {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async initialize(): Promise<void> {
    // Verify the token is valid by making a test request
    const response = await this.request("/api/user");
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Access token is invalid or expired. Please generate a new token from Noverload.");
      }
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Invalid access token or API unavailable: ${response.status} - ${errorText}`);
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await this.request("/api/user");
      return response.ok;
    } catch {
      return false;
    }
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.config.apiUrl}${path}`;
    return fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });
  }

  /**
   * Transform raw API content to schema format
   * Handles both camelCase and snake_case field names from API
   * Required fields (id, url) are passed through - Zod validates them
   */
  private transformRawContent(item: Record<string, unknown>): Record<string, unknown> {
    // Get required fields - let Zod validate they exist
    const id = item.id ?? item._id;
    const url = item.url;

    if (!id || !url) {
      throw new Error(`Invalid content from API: missing ${!id ? 'id' : 'url'}`);
    }

    return {
      // Required fields
      id,
      url,

      // Optional metadata - use undefined if missing, not empty string
      userId: item.userId ?? item.user_id ?? undefined,
      title: item.title ?? null,
      description: item.description ?? null,

      // Fields with defaults handled by schema
      contentType: item.contentType ?? item.content_type ?? undefined,
      status: item.status ?? undefined,

      // Content fields
      summary: item.summary ?? null,
      keyInsights: item.keyInsights ?? item.key_insights ?? null,
      rawText: item.rawText ?? item.raw_text ?? null,
      tokenCount: item.tokenCount ?? item.token_count ?? null,
      ogImage: item.ogImage ?? item.og_image ?? null,
      processingMetadata: item.processingMetadata ?? item.processing_metadata ?? null,

      // Tags
      tags: item.tags ?? undefined,

      // Timestamps - pass through as-is, no fabrication
      createdAt: item.createdAt ?? item.created_at ?? undefined,
      updatedAt: item.updatedAt ?? item.updated_at ?? undefined,
    };
  }

  // Content methods
  async listContent(filters?: {
    status?: string;
    contentType?: string;
    limit?: number;
  }): Promise<Content[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.contentType) params.append("type", filters.contentType);
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await this.request(`/api/mcp/v2/content?${params}`);

    if (!response.ok) {
      let errorMessage = "Failed to fetch content list";
      try {
        const errorData = await response.json() as { message?: string; error?: string; code?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.code) {
          errorMessage = `[${errorData.code}] ${errorMessage}`;
        }
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as Record<string, unknown>;
    // v2 returns { success, contents, pagination }
    const rawContents = (data.contents ?? data) as Record<string, unknown>[];

    if (!Array.isArray(rawContents)) {
      throw new Error("Invalid API response: expected array of contents");
    }

    // Transform and validate each item
    const transformedContents = rawContents.map((item) => this.transformRawContent(item));

    return z.array(ContentSchema).parse(transformedContents);
  }

  async getContent(id: string): Promise<Content> {
    const response = await this.request(`/api/mcp/v2/content?id=${id}`);

    if (!response.ok) {
      let errorMessage = `Failed to get content with ID: ${id}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string; code?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.code) {
          errorMessage = `[${errorData.code}] ${errorMessage}`;
        }
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as Record<string, unknown>;
    // v2 returns { success, content }
    const rawContent = (data.content ?? data) as Record<string, unknown>;

    if (!rawContent || typeof rawContent !== 'object') {
      throw new Error(`Invalid API response for content ID: ${id}`);
    }

    // Transform and validate
    const transformedContent = this.transformRawContent(rawContent);
    return ContentSchema.parse(transformedContent);
  }

  async saveContent(url: string): Promise<Content> {
    if (this.config.readOnly) {
      throw new Error("Cannot save content in read-only mode");
    }

    // v2 API doesn't support saving - use the main API endpoint
    const response = await this.request("/api/mcp/content", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to save content from URL: ${url}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string; code?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.code) {
          errorMessage = `[${errorData.code}] ${errorMessage}`;
        }
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json() as any;
    return ContentSchema.parse(data);
  }

  /**
   * Transform raw API action to schema format
   * Handles both camelCase and snake_case field names from API
   */
  private transformRawAction(item: Record<string, unknown>): Record<string, unknown> {
    const id = item.id;
    const title = item.title;

    if (!id || !title) {
      throw new Error(`Invalid action from API: missing ${!id ? 'id' : 'title'}`);
    }

    return {
      id,
      title,
      contentId: item.contentId ?? item.content_id ?? undefined,
      goalId: item.goalId ?? item.goal_id ?? null,
      description: item.description ?? null,
      priority: item.priority ?? undefined,
      completed: item.completed ?? item.is_completed ?? false,
      completedAt: item.completedAt ?? item.completed_at ?? null,
      createdAt: item.createdAt ?? item.created_at ?? undefined,
    };
  }

  // Action methods
  async listActions(filters?: {
    contentId?: string;
    goalId?: string;
    completed?: boolean;
  }): Promise<Action[]> {
    const params = new URLSearchParams();
    if (filters?.contentId) params.append("contentId", filters.contentId);
    if (filters?.goalId) params.append("goalId", filters.goalId);
    if (filters?.completed !== undefined) {
      params.append("completed", filters.completed.toString());
    }

    const response = await this.request(`/api/mcp/v2/actions?${params}`);
    if (!response.ok) throw new Error("Failed to fetch actions");

    const data = await response.json() as Record<string, unknown>;
    // v2 returns { success, actions, pagination, statistics }
    const rawActions = (data.actions ?? data) as Record<string, unknown>[];

    if (!Array.isArray(rawActions)) {
      throw new Error("Invalid API response: expected array of actions");
    }

    // Transform and validate each item
    const transformedActions = rawActions.map((item) => this.transformRawAction(item));
    return z.array(ActionSchema).parse(transformedActions);
  }

  async completeAction(id: string): Promise<Action> {
    if (this.config.readOnly) {
      throw new Error("Cannot complete action in read-only mode");
    }

    const response = await this.request(`/api/mcp/v2/actions`, {
      method: "POST",
      body: JSON.stringify({ actionId: id, status: "completed" }),
    });
    
    if (!response.ok) throw new Error("Failed to complete action");
    
    const data = await response.json() as any;
    return ActionSchema.parse(data);
  }

  // Goal methods
  async listGoals(): Promise<Goal[]> {
    // Goals endpoint stays the same for now
    const response = await this.request("/api/mcp/goals");
    if (!response.ok) throw new Error("Failed to fetch goals");
    
    const data = await response.json() as any;
    return z.array(GoalSchema).parse(data);
  }

  async searchContent(
    query: string, 
    options?: { 
      tags?: string[];
      limit?: number;
      includeFullContent?: boolean;
      contentTypes?: string[];
      dateFrom?: string;
      dateTo?: string;
      excludeDomains?: string[];
      enableConceptExpansion?: boolean;
      searchMode?: "any" | "all" | "phrase";
      fuzzyMatch?: boolean;
    }
  ): Promise<any> {
    // Try v2 search first with better configuration
    try {
      // Determine the best search mode based on parameters
      let searchMode: "smart" | "semantic" | "hybrid" | "fulltext" = "smart";
      
      // If searchMode is explicitly specified, map it appropriately
      if (options?.searchMode) {
        if (options.searchMode === "phrase" || options.searchMode === "all") {
          searchMode = "fulltext"; // Use fulltext for exact/all matching
        } else if (options.searchMode === "any") {
          searchMode = "hybrid"; // Use hybrid for broader matching
        }
      }
      
      // Override to semantic if concept expansion is explicitly requested
      if (options?.enableConceptExpansion === true) {
        searchMode = "semantic";
      }
      
      const v2Body = {
        query,
        mode: searchMode, // Use appropriate mode based on request
        filters: options?.contentTypes || options?.tags || options?.dateFrom ? {
          contentTypes: options?.contentTypes,
          dateRange: (options?.dateFrom || options?.dateTo) ? {
            from: options?.dateFrom,
            to: options?.dateTo,
          } : undefined,
          tags: options?.tags,
          domains: options?.excludeDomains ? {
            exclude: options.excludeDomains,
          } : undefined,
        } : undefined,
        options: {
          limit: options?.limit || 10,
          includeContent: options?.includeFullContent || false,
          includeMetadata: true, // Always include metadata for richer results
          includeSnippets: true, // Include snippets with highlights
          minRelevance: 0.25, // Lower threshold for vector search to catch more results
        },
        features: {
          expandConcepts: options?.enableConceptExpansion !== false, // Default to true
          includeRelated: false, // Don't include related by default (token heavy)
          aggregateInsights: false, // Don't aggregate by default
        },
      };

      const response = await this.request(`/api/mcp/v2/search`, {
        method: "POST",
        body: JSON.stringify(v2Body),
      });
      
      if (!response.ok) {
        // Fall back to v1 search if v2 fails
        console.warn(`v2 search failed with status ${response.status}, trying v1 fallback`);
        return this.searchContentV1(query, options);
      }
      
      const data = await response.json() as any;
      
      // v2 returns { success, query, results, pagination, metadata }
      const results = data?.results || [];
      if (Array.isArray(results) && results.length > 0) {
        return results.map((item: Record<string, unknown>) => {
          // Transform content fields using helper, but preserve search-specific fields
          const baseContent = this.transformRawContent(item);
          return {
            ...baseContent,
            // Search-specific fields
            relevanceScore: (item.relevanceScore ?? item.score ?? 0) as number,
          };
        });
      }
      
      // If no results, try a fallback search with looser parameters
      if (results.length === 0 && !options?.includeFullContent) {
        console.log("No results found, trying broader search...");
        return this.searchContentV1(query, options);
      }
      
      return [];
    } catch (error) {
      console.error("v2 search error:", error);
      // Fall back to v1 search
      return this.searchContentV1(query, options);
    }
  }

  // Fallback v1 search method for compatibility
  private async searchContentV1(
    query: string,
    options?: any
  ): Promise<any> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: (options?.limit || 10).toString(),
      });
      
      if (options?.includeFullContent) params.append("includeFullContent", "true");
      if (options?.contentTypes) params.append("contentTypes", options.contentTypes.join(","));
      if (options?.tags) params.append("tags", options.tags.join(","));
      
      const response = await this.request(`/api/mcp/search?${params}`);
      
      if (!response.ok) {
        console.error(`v1 search also failed: ${response.status}`);
        return [];
      }
      
      const data = await response.json() as Record<string, unknown>;
      const results = Array.isArray(data) ? data : ((data.results ?? []) as Record<string, unknown>[]);

      return results.map((item: Record<string, unknown>) => this.transformRawContent(item));
    } catch (error) {
      console.error("v1 search error:", error);
      return [];
    }
  }

  // New v2 search method with enhanced features
  async searchContentV2(params: {
    query: string;
    mode?: "smart" | "semantic" | "fulltext" | "hybrid" | "any" | "all" | "phrase";
    limit?: number;
    contentTypes?: string[];
    includeContent?: boolean;
    minRelevance?: number;
  }): Promise<any> {
    // Map legacy modes to v2 modes
    let searchMode: "smart" | "semantic" | "hybrid" | "fulltext" = "smart";
    if (params.mode) {
      if (params.mode === "semantic") searchMode = "semantic";
      else if (params.mode === "hybrid" || params.mode === "any") searchMode = "hybrid";
      else if (params.mode === "fulltext" || params.mode === "all" || params.mode === "phrase") searchMode = "fulltext";
      else searchMode = "smart";
    }
    
    const body = {
      query: params.query,
      mode: searchMode,
      filters: params.contentTypes ? {
        contentTypes: params.contentTypes,
      } : undefined,
      options: {
        limit: params.limit || 10,
        includeContent: params.includeContent || false,
        includeMetadata: true,
        includeSnippets: true,
        minRelevance: params.minRelevance || 0.25, // Lower threshold for better recall
      },
      features: {
        expandConcepts: searchMode === "semantic" || searchMode === "smart",
        includeRelated: false,
        aggregateInsights: false,
      },
    };

    const response = await this.request(`/api/mcp/v2/search`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      // Fall back to v1 search if v2 fails
      console.warn(`v2 search failed with status ${response.status}, trying v1 fallback`);
      return this.searchContentV1(params.query, {
        limit: params.limit,
        contentTypes: params.contentTypes,
        includeFullContent: params.includeContent,
      });
    }
    
    const data = await response.json() as any;
    
    // Map results to include aiInsights field
    if (data.results) {
      data.results = data.results.map((item: any) => ({
        ...item,
        aiInsights: item.ai_insights || item.aiInsights || item.processingMetadata?.ai_insights || {},
      }));
    }
    
    return data;
  }

  // New methods for enhanced endpoints
  async estimateSearchTokens(query: string, limit: number = 10): Promise<any> {
    
    // Use v2 search with estimateOnly flag
    const response = await this.request(`/api/mcp/v2/search`, {
      method: "POST",
      body: JSON.stringify({
        query,
        options: { limit },
        features: { estimateOnly: true },
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to estimate search tokens");
    }
    
    const data = await response.json() as any;
    // v2 returns { estimate, warning, recommendations }
    return data.estimate || data;
  }

  async synthesizeContent(params: {
    query: string;
    contentIds?: string[];
    synthesisMode?: "overview" | "deep" | "actionable" | "comparison";
    findContradictions?: boolean;
    findConnections?: boolean;
    maxSources?: number;
  }): Promise<any> {
    try {
      // If no content IDs provided, search for relevant content first
      let sourceIds = params.contentIds;

      if (!sourceIds || sourceIds.length === 0) {
        // Search for content related to the query using multiple strategies
        console.log(`[Synthesis] No contentIds provided, searching for: "${params.query}"`);

        // Try semantic search first
        const searchResults = await this.searchContent(params.query, {
          limit: params.maxSources || 10,
          enableConceptExpansion: true,
        });

        if (searchResults && searchResults.length > 0) {
          sourceIds = searchResults.map((item: any) => item.id).filter((id: any) => id);
          console.log(`[Synthesis] Found ${sourceIds?.length || 0} sources via search`);
        }

        // If search found nothing, try getting recent content as fallback
        if (!sourceIds || sourceIds.length === 0) {
          console.log("[Synthesis] Search returned no results, trying recent content");
          try {
            const recentContent = await this.listContent({ limit: params.maxSources || 5 });
            if (recentContent && recentContent.length > 0) {
              sourceIds = recentContent.map((item: any) => item.id).filter((id: any) => id);
              console.log(`[Synthesis] Using ${sourceIds.length} recent content items`);
            }
          } catch (e) {
            console.warn("[Synthesis] Failed to get recent content:", e);
          }
        }

        if (!sourceIds || sourceIds.length === 0) {
          return {
            success: false,
            error: "No content found to synthesize. Please save some content first or provide specific content IDs.",
            synthesis: null,
          };
        }
      }

      // Map synthesis modes from client to API format
      // Client uses: "overview" | "deep" | "actionable" | "comparison"
      // API expects: "overview" | "actionable" | "comparative" | "thematic"
      const modeMap: Record<string, string> = {
        "overview": "overview",
        "deep": "thematic", // deep maps to thematic for comprehensive analysis
        "actionable": "actionable",
        "comparison": "comparative", // comparison -> comparative
      };
      const apiMode = modeMap[params.synthesisMode || "actionable"] || "actionable";

      // Try v2 synthesis endpoint
      const v2Body = {
        sources: {
          contentIds: sourceIds,
          limit: params.maxSources || 10,
        },
        synthesis: {
          mode: apiMode,
          depth: "standard",
        },
        output: {
          includeContradictions: params.findContradictions || false,
          includeConnections: params.findConnections !== false, // Default true
          includeQuotes: true,
          includeActionPlan: params.synthesisMode === "actionable",
        },
      };

      console.log(`[Synthesis] Sending request with ${sourceIds.length} sources, mode: ${apiMode}`);

      const response = await this.request("/api/mcp/v2/synthesis", {
        method: "POST",
        body: JSON.stringify(v2Body),
      });
      
      if (!response.ok) {
        // Try fallback v1 synthesis
        console.warn(`v2 synthesis failed with status ${response.status}, trying v1 fallback`);
        return this.synthesizeContentV1(params, sourceIds);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Synthesis error:", error);
      // Try v1 fallback
      return this.synthesizeContentV1(params, params.contentIds);
    }
  }

  // Fallback v1 synthesis method
  private async synthesizeContentV1(
    params: any,
    contentIds?: string[]
  ): Promise<any> {
    try {
      // If we don't have content IDs, we need to search first
      if (!contentIds || contentIds.length === 0) {
        const searchResults = await this.searchContent(params.query, {
          limit: params.maxSources || 5,
        });
        
        if (!searchResults || searchResults.length === 0) {
          return {
            success: false,
            error: "No content found to synthesize",
            synthesis: null,
          };
        }
        
        contentIds = searchResults.map((item: any) => item.id).filter((id: any) => id);
      }
      
      // Try a simpler synthesis approach
      const response = await this.request("/api/mcp/synthesis", {
        method: "POST",
        body: JSON.stringify({
          query: params.query,
          contentIds: contentIds,
          mode: params.synthesisMode || "actionable",
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          error: `Synthesis failed: ${errorText}`,
          synthesis: null,
        };
      }
      
      return response.json();
    } catch (error) {
      return {
        success: false,
        error: `Synthesis error: ${error}`,
        synthesis: null,
      };
    }
  }

  async findSimilarContent(contentId: string, options?: {
    limit?: number;
    minSimilarity?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.minSimilarity) params.append("minSimilarity", options.minSimilarity.toString());
    
    // v2 doesn't have a direct similar endpoint yet, use v1 for now
    const response = await this.request(`/api/mcp/content/${contentId}/similar?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to find similar content for ID: ${contentId}`);
    }
    
    return response.json();
  }

  async batchGetContent(ids: string[], includeFullContent: boolean = false): Promise<any> {
    // Use v2 content endpoint with batch operation
    const response = await this.request("/api/mcp/v2/content", {
      method: "POST",
      body: JSON.stringify({
        operation: "get",
        contentIds: ids,
        enrich: {
          includeContent: includeFullContent,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to batch fetch content");
    }
    
    return response.json();
  }

  async getEnrichedContent(ids: string[], includeFullContent: boolean = false): Promise<any> {
    try {
      const response = await this.request("/api/mcp/v2/content", {
        method: "POST",
        body: JSON.stringify({
          operation: "get",
          contentIds: ids,
          enrich: {
            includeContent: includeFullContent,
            includeActions: false,
            includeConcepts: false,
            includeRelated: false,
          },
          tokenOptions: {
            requireConfirmation: false, // We handle confirmation in the tool
          },
        }),
      });
      
      if (!response.ok) {
        console.error(`Get enriched content failed: ${response.status}`);
        return [];
      }
      
      const data = await response.json() as any;
      
      // Handle confirmation requirement
      if (data.requiresConfirmation) {
        // For now, return empty - the tool will handle the warning
        console.log("Content requires confirmation:", data.message);
        return [];
      }
      
      return data.contents || [];
    } catch (error) {
      console.error("Get enriched content error:", error);
      return [];
    }
  }

  // Tag methods
  async listTags(): Promise<TagsResponse> {
    const response = await this.request("/api/mcp/tags");

    if (!response.ok) {
      let errorMessage = "Failed to fetch tags";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return TagsResponseSchema.parse(data);
  }

  async createTag(name: string): Promise<CreateTagResponse> {
    if (this.config.readOnly) {
      throw new Error("Cannot create tag in read-only mode");
    }

    const response = await this.request("/api/mcp/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to create tag: ${name}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return CreateTagResponseSchema.parse(data);
  }

  async addTagsToContent(contentId: string, tags: string[]): Promise<AddTagsResponse> {
    if (this.config.readOnly) {
      throw new Error("Cannot add tags in read-only mode");
    }

    const response = await this.request(`/api/mcp/content/${contentId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      let errorMessage = "Failed to add tags to content";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return AddTagsResponseSchema.parse(data);
  }

  async removeTagsFromContent(contentId: string, tags: string[]): Promise<RemoveTagsResponse> {
    if (this.config.readOnly) {
      throw new Error("Cannot remove tags in read-only mode");
    }

    const response = await this.request(`/api/mcp/content/${contentId}/tags`, {
      method: "DELETE",
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      let errorMessage = "Failed to remove tags from content";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return RemoveTagsResponseSchema.parse(data);
  }

  async getContentTags(contentId: string): Promise<Tag[]> {
    const response = await this.request(`/api/mcp/content/${contentId}/tags`);

    if (!response.ok) {
      let errorMessage = "Failed to get content tags";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as { tags: unknown[] };
    return z.array(TagSchema).parse(data.tags || []);
  }

  // Swipe file methods
  async markAsSwipeFile(contentId: string): Promise<MarkSwipeFileResponse> {
    if (this.config.readOnly) {
      throw new Error("Cannot mark as swipe file in read-only mode");
    }

    const response = await this.request(`/api/mcp/content/${contentId}/swipe-file`, {
      method: "POST",
    });

    if (!response.ok) {
      let errorMessage = "Failed to mark as swipe file";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return MarkSwipeFileResponseSchema.parse(data);
  }

  async unmarkAsSwipeFile(contentId: string): Promise<UnmarkSwipeFileResponse> {
    if (this.config.readOnly) {
      throw new Error("Cannot unmark swipe file in read-only mode");
    }

    const response = await this.request(`/api/mcp/content/${contentId}/swipe-file`, {
      method: "DELETE",
    });

    if (!response.ok) {
      let errorMessage = "Failed to unmark swipe file";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return UnmarkSwipeFileResponseSchema.parse(data);
  }

  async getSwipeFileStatus(contentId: string): Promise<SwipeFileStatusResponse> {
    const response = await this.request(`/api/mcp/content/${contentId}/swipe-file`);

    if (!response.ok) {
      let errorMessage = "Failed to get swipe file status";
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        if (errorData.message) errorMessage = errorData.message;
        else if (errorData.error) errorMessage = errorData.error;
      } catch {
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return SwipeFileStatusResponseSchema.parse(data);
  }
}