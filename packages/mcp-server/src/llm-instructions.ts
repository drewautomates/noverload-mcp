/**
 * Dynamic LLM Instructions for Optimal MCP Usage
 * These instructions help LLMs understand how to best utilize the Noverload MCP
 */

export interface LLMInstructions {
  version: string;
  capabilities: ToolCapabilities;
  bestPractices: UsagePatterns;
  tokenManagement: TokenGuidance;
  exampleWorkflows: WorkflowExample[];
}

interface ToolCapabilities {
  search: {
    description: string;
    strengths: string[];
    limitations: string[];
    whenToUse: string[];
  };
  synthesis: {
    description: string;
    strengths: string[];
    limitations: string[];
    whenToUse: string[];
  };
  retrieval: {
    description: string;
    strengths: string[];
    limitations: string[];
    whenToUse: string[];
  };
}

interface UsagePatterns {
  forQuestions: string;
  forResearch: string;
  forFactChecking: string;
  forLearning: string;
  forSynthesis: string;
}

interface TokenGuidance {
  searchResultsLimit: number;
  useChunking: boolean;
  summaryFirst: boolean;
  maxContentPerQuery: number;
}

interface WorkflowExample {
  scenario: string;
  steps: string[];
  expectedOutcome: string;
}

export function generateLLMInstructions(
  userContentStats?: {
    totalContent: number;
    contentTypes: Record<string, number>;
    averageTokenCount: number;
  }
): LLMInstructions {
  return {
    version: "1.0.0",
    
    capabilities: {
      search: {
        description: "Semantic and keyword search with OpenAI embeddings",
        strengths: [
          "Finds content by meaning, not just keywords",
          "Supports filters by type, date, and tags",
          "Returns relevance scores and explanations",
          "Can expand queries with related concepts"
        ],
        limitations: [
          "May miss very recent content (< 1 hour old)",
          "Embeddings work best with clear, specific queries",
          "Complex multi-part questions should be broken down"
        ],
        whenToUse: [
          "User asks about a specific topic",
          "Need to find all content related to a concept",
          "Looking for specific types of content (videos, articles)",
          "Want to understand what user has saved on a topic"
        ]
      },
      
      synthesis: {
        description: "Combines insights from multiple content sources",
        strengths: [
          "Identifies patterns across content",
          "Finds contradictions and agreements",
          "Creates actionable summaries",
          "Generates timelines and progressions"
        ],
        limitations: [
          "Best with 3-10 sources",
          "May miss nuances in very technical content",
          "Requires good search results as input"
        ],
        whenToUse: [
          "User wants comprehensive understanding",
          "Need to compare different viewpoints",
          "Creating action plans from content",
          "Identifying trends or patterns"
        ]
      },
      
      retrieval: {
        description: "Access to full content and metadata",
        strengths: [
          "Provides complete raw text when needed",
          "Includes summaries and key insights",
          "Shows relationships between content",
          "Returns processing metadata"
        ],
        limitations: [
          "Large content may exceed token limits",
          "Raw text should be requested sparingly",
          "Some content may still be processing"
        ],
        whenToUse: [
          "Need exact quotes or specific details",
          "Analyzing writing style or tone",
          "Deep dive into particular content",
          "Extracting specific data points"
        ]
      }
    },
    
    bestPractices: {
      forQuestions: "Start with search_content using semantic mode, then get_content_details for top results",
      forResearch: "Use search_content with broad query, then synthesize_content to find patterns, finally get details on key items",
      forFactChecking: "Search for specific claim, then find_similar_content to see related items, check for contradictions",
      forLearning: "List_saved_content by type, identify foundational content, then build up with find_similar_content",
      forSynthesis: "Search broadly first, synthesize top 5-7 results, then drill into specific insights"
    },
    
    tokenManagement: {
      searchResultsLimit: 10, // Default, adjust based on context window
      useChunking: true, // For content over 4000 tokens
      summaryFirst: true, // Always get summaries before full text
      maxContentPerQuery: 50000 // tokens
    },
    
    exampleWorkflows: [
      {
        scenario: "User asks: 'What have I learned about productivity?'",
        steps: [
          "search_content('productivity', { limit: 15, searchMode: 'semantic' })",
          "synthesize_content({ query: 'productivity methods and tips', synthesisMode: 'actionable' })",
          "For top insights, get_content_details() for specific examples"
        ],
        expectedOutcome: "Comprehensive overview with actionable productivity insights from user's saved content"
      },
      {
        scenario: "User asks: 'Find everything about AI from Yann LeCun'",
        steps: [
          "search_content('Yann LeCun AI', { searchMode: 'hybrid' })",
          "For each result, check if Yann LeCun is mentioned in title or summary",
          "find_similar_content() for the most relevant item",
          "synthesize_content() for all Yann LeCun content"
        ],
        expectedOutcome: "All content featuring Yann LeCun's perspectives on AI"
      },
      {
        scenario: "User asks: 'Help me understand machine learning basics'",
        steps: [
          "search_content('machine learning basics introduction', { limit: 20 })",
          "Filter results for beginner-friendly content",
          "Order by date (older fundamentals first)",
          "Create learning path with get_content_details() for each"
        ],
        expectedOutcome: "Structured learning path from user's saved ML content"
      },
      {
        scenario: "User asks: 'What do different sources say about remote work?'",
        steps: [
          "search_content('remote work', { limit: 20 })",
          "synthesize_content({ findContradictions: true, findConnections: true })",
          "Group by perspective (pro/con/neutral)",
          "Highlight contradictions and consensus points"
        ],
        expectedOutcome: "Balanced view of remote work perspectives from saved content"
      }
    ]
  };
}

/**
 * Generate contextual instructions based on current query
 */
export function getContextualInstructions(
  query: string,
  context?: {
    previousQueries?: string[];
    userPreferences?: Record<string, any>;
    sessionGoal?: string;
  }
): string {
  const instructions: string[] = [];
  
  // Query-specific guidance
  if (query.toLowerCase().includes('how') || query.toLowerCase().includes('why')) {
    instructions.push("This appears to be an explanatory query. Focus on educational content and tutorials.");
  }
  
  if (query.toLowerCase().includes('latest') || query.toLowerCase().includes('recent')) {
    instructions.push("User wants recent information. Sort by date and prioritize newer content.");
  }
  
  if (query.toLowerCase().includes('all') || query.toLowerCase().includes('everything')) {
    instructions.push("Comprehensive search requested. Consider using higher limits and multiple search modes.");
  }
  
  if (query.includes('?')) {
    instructions.push("Direct question detected. Prioritize content with clear answers and actionable insights.");
  }
  
  // Context-based guidance
  if (context?.previousQueries?.length) {
    instructions.push(`Building on previous queries: ${context.previousQueries.slice(-2).join(', ')}. Maintain context continuity.`);
  }
  
  if (context?.sessionGoal) {
    instructions.push(`Session goal: ${context.sessionGoal}. Align responses with this objective.`);
  }
  
  return instructions.join(' ');
}

/**
 * Token usage estimator for planning queries
 */
export function estimateTokenUsage(operation: {
  tool: string;
  params: Record<string, any>;
}): {
  estimated: number;
  warning?: string;
  suggestion?: string;
} {
  let tokens = 0;
  let warning: string | undefined;
  let suggestion: string | undefined;
  
  switch (operation.tool) {
    case 'search_content':
      tokens = (operation.params.limit || 10) * 200; // Rough estimate per result
      if (operation.params.includeFullContent) {
        tokens *= 10; // Full content is much larger
        warning = "Including full content will use significant tokens";
        suggestion = "Consider getting summaries first, then specific content";
      }
      break;
      
    case 'get_content_details':
      tokens = 5000; // Average content size
      if (operation.params.includeFullText) {
        tokens = 15000;
        warning = "Full text may be very large";
        suggestion = "Consider using sections or summaries";
      }
      break;
      
    case 'synthesize_content':
      tokens = 3000 + (operation.params.maxSources || 5) * 500;
      break;
      
    case 'list_saved_content':
      tokens = (operation.params.limit || 20) * 150;
      break;
  }
  
  return { estimated: tokens, warning, suggestion };
}

/**
 * Generate a query plan for complex requests
 */
export function planQueryStrategy(
  userRequest: string,
  availableTools: string[]
): {
  strategy: 'simple' | 'multi-step' | 'exploratory';
  steps: Array<{
    tool: string;
    purpose: string;
    params: Record<string, any>;
  }>;
  estimatedTokens: number;
} {
  // Analyze request complexity
  const isComplex = userRequest.split(' ').length > 15 ||
                    userRequest.includes(' and ') ||
                    userRequest.includes(' then ') ||
                    userRequest.includes(' also ');
  
  const isExploratory = userRequest.includes('explore') ||
                        userRequest.includes('everything') ||
                        userRequest.includes('understand') ||
                        userRequest.includes('learn about');
  
  if (isExploratory) {
    return {
      strategy: 'exploratory',
      steps: [
        {
          tool: 'search_content',
          purpose: 'Initial broad search',
          params: { limit: 20, searchMode: 'semantic' }
        },
        {
          tool: 'synthesize_content',
          purpose: 'Find patterns and insights',
          params: { synthesisMode: 'deep', maxSources: 10 }
        },
        {
          tool: 'find_similar_content',
          purpose: 'Expand understanding',
          params: { limit: 5 }
        }
      ],
      estimatedTokens: 8000
    };
  }
  
  if (isComplex) {
    return {
      strategy: 'multi-step',
      steps: [
        {
          tool: 'search_content',
          purpose: 'Find relevant content',
          params: { limit: 15, searchMode: 'hybrid' }
        },
        {
          tool: 'get_content_details',
          purpose: 'Get details for top results',
          params: { includeFullText: false }
        },
        {
          tool: 'synthesize_content',
          purpose: 'Combine insights',
          params: { synthesisMode: 'actionable' }
        }
      ],
      estimatedTokens: 5000
    };
  }
  
  return {
    strategy: 'simple',
    steps: [
      {
        tool: 'search_content',
        purpose: 'Direct search',
        params: { limit: 10, searchMode: 'smart' }
      }
    ],
    estimatedTokens: 2000
  };
}