import { z } from "zod";

export interface ClientConfig {
  accessToken: string;
  apiUrl: string;
  readOnly: boolean;
}

// Schema definitions matching your Noverload database
export const ContentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  contentType: z.enum(["youtube", "x_twitter", "reddit", "article", "pdf"]),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  summary: z.any().nullable(), // Can be string or object
  keyInsights: z.array(z.string()).nullable(),
  rawText: z.string().nullable().optional(), // Full content text
  tokenCount: z.number().nullable().optional(), // Estimated token count for raw_text
  ogImage: z.string().nullable().optional(),
  processingMetadata: z.any().nullable().optional(),
  tags: z.array(z.string()).optional(), // Associated tags
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ActionSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  goalId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(["high", "medium", "low"]),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
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

export type Content = z.infer<typeof ContentSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Goal = z.infer<typeof GoalSchema>;

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
    
    const data = await response.json() as any;
    // v2 returns { success, contents, pagination }
    const contents = data.contents || data;
    return z.array(ContentSchema).parse(contents);
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
        // If JSON parsing fails, use status text
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json() as any;
    // v2 returns { success, content }
    const content = data.content || data;
    return ContentSchema.parse(content);
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
    
    const data = await response.json() as any;
    // v2 returns { success, actions, pagination, statistics }
    const result = data.actions || data;
    return z.array(ActionSchema).parse(result);
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
    }
  ): Promise<any> {
    // Use the enhanced search endpoint
    const params = new URLSearchParams({
      q: query,
      limit: (options?.limit || 10).toString(),
    });
    
    if (options?.includeFullContent) params.append("includeFullContent", "true");
    if (options?.contentTypes) params.append("contentTypes", options.contentTypes.join(","));
    if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
    if (options?.dateTo) params.append("dateTo", options.dateTo);
    if (options?.tags) params.append("tags", options.tags.join(","));
    if (options?.excludeDomains) params.append("excludeDomains", options.excludeDomains.join(","));
    if (options?.enableConceptExpansion) params.append("enableConceptExpansion", "true");
    
    // Convert to v2 search format
    const v2Body = {
      query,
      mode: "smart",
      filters: {
        contentTypes: options?.contentTypes,
        dateRange: {
          from: options?.dateFrom,
          to: options?.dateTo,
        },
        tags: options?.tags,
        domains: {
          exclude: options?.excludeDomains,
        },
      },
      options: {
        limit: options?.limit || 10,
        includeContent: options?.includeFullContent || false,
      },
      features: {
        expandConcepts: options?.enableConceptExpansion || false,
      },
    };

    const response = await this.request(`/api/mcp/v2/search`, {
      method: "POST",
      body: JSON.stringify(v2Body),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`Search failed: ${response.status} - ${errorText}`);
      throw new Error("Search failed");
    }
    
    const data = await response.json() as any;
    
    // v2 returns { success, query, results, pagination, metadata }
    const results = data?.results || [];
    if (Array.isArray(results)) {
      return results.map((item: any) => ({
        id: item.id,
        userId: item.userId || "",
        url: item.url || "",
        title: item.title,
        description: item.description || (typeof item.summary === 'string' ? item.summary.slice(0, 500) : ""),
        contentType: item.contentType || "article",
        status: item.metadata?.processingStatus || "completed",
        summary: item.summary, // Keep the full summary object
        keyInsights: item.keyInsights || [],
        rawText: item.rawText || item.fullContent || null, // Check both fields
        ogImage: item.ogImage || null,
        processingMetadata: item.processingMetadata || null,
        tags: item.tags || [], // Include tags
        createdAt: item.metadata?.createdAt || item.createdAt || new Date().toISOString(),
        updatedAt: item.metadata?.updatedAt || item.updatedAt || new Date().toISOString(),
        // Include relevance score for better sorting
        relevanceScore: item.relevanceScore,
      }));
    }
    
    console.warn("No results found in search response");
    return [];
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
    // Convert to v2 synthesis format
    const v2Body = {
      sources: {
        contentIds: params.contentIds,
        query: params.contentIds ? undefined : params.query,
        limit: params.maxSources,
      },
      synthesis: {
        mode: params.synthesisMode || "actionable",
        depth: "standard",
      },
      output: {
        includeContradictions: params.findContradictions,
        includeConnections: params.findConnections,
        includeQuotes: true,
        includeActionPlan: params.synthesisMode === "actionable",
      },
    };

    const response = await this.request("/api/mcp/v2/synthesis", {
      method: "POST",
      body: JSON.stringify(v2Body),
    });
    
    if (!response.ok) {
      throw new Error("Failed to synthesize content");
    }
    
    return response.json();
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
}