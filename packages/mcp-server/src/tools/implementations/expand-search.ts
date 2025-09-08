import { z } from "zod";
import { NoverloadClient } from "../../client.js";
import { Tool } from "../types.js";

const inputSchema = z.object({
  originalQuery: z
    .string()
    .describe("The original search query that returned few/no results"),
  noResultsFound: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether the original search returned no results"),
  context: z
    .string()
    .optional()
    .describe("Additional context about what the user is looking for"),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of expanded queries to return"),
});

// Concept mapping for semantic expansion
const CONCEPT_MAP: Record<string, string[]> = {
  // Business & Growth
  storytelling: [
    "narrative",
    "pitch",
    "story",
    "presentation",
    "messaging",
    "communication",
    "branding",
  ],
  growth: [
    "scaling",
    "expansion",
    "increase",
    "development",
    "progress",
    "evolution",
    "traction",
  ],
  marketing: [
    "promotion",
    "advertising",
    "branding",
    "outreach",
    "campaign",
    "content",
    "social media",
  ],
  sales: [
    "selling",
    "revenue",
    "conversion",
    "closing",
    "pipeline",
    "deals",
    "customers",
  ],
  startup: [
    "founder",
    "entrepreneur",
    "venture",
    "bootstrap",
    "launch",
    "MVP",
    "product-market fit",
  ],

  // Technology
  ai: [
    "artificial intelligence",
    "machine learning",
    "ML",
    "deep learning",
    "neural network",
    "LLM",
    "GPT",
  ],
  framework: [
    "methodology",
    "system",
    "process",
    "structure",
    "approach",
    "model",
    "pattern",
  ],
  api: [
    "interface",
    "endpoint",
    "integration",
    "webhook",
    "REST",
    "GraphQL",
    "service",
  ],
  database: [
    "DB",
    "SQL",
    "NoSQL",
    "data storage",
    "postgres",
    "mongodb",
    "schema",
  ],

  // Content & Learning
  tutorial: [
    "guide",
    "how-to",
    "walkthrough",
    "instruction",
    "lesson",
    "course",
    "training",
  ],
  example: [
    "case study",
    "instance",
    "sample",
    "demonstration",
    "illustration",
    "use case",
    "scenario",
  ],
  "best practices": [
    "guidelines",
    "standards",
    "recommendations",
    "tips",
    "advice",
    "patterns",
    "conventions",
  ],

  // Strategy & Planning
  strategy: [
    "plan",
    "approach",
    "tactics",
    "roadmap",
    "blueprint",
    "methodology",
    "framework",
  ],
  metrics: [
    "KPIs",
    "analytics",
    "measurements",
    "data",
    "statistics",
    "tracking",
    "performance",
  ],
  optimization: [
    "improvement",
    "enhancement",
    "efficiency",
    "performance",
    "refinement",
    "tuning",
  ],

  // Product & Development
  feature: [
    "functionality",
    "capability",
    "component",
    "module",
    "tool",
    "service",
    "option",
  ],
  bug: ["issue", "problem", "error", "defect", "glitch", "fault", "failure"],
  design: [
    "UX",
    "UI",
    "interface",
    "layout",
    "architecture",
    "structure",
    "pattern",
  ],
};

// Reverse mapping for bidirectional expansion
const REVERSE_MAP: Map<string, string[]> = new Map();
for (const [key, values] of Object.entries(CONCEPT_MAP)) {
  for (const value of values) {
    if (!REVERSE_MAP.has(value)) {
      REVERSE_MAP.set(value, []);
    }
    REVERSE_MAP.get(value)!.push(key);
  }
}

function expandConcepts(query: string): string[] {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);
  const expandedTerms = new Set<string>();

  // For each word in the query
  for (const word of words) {
    // Check direct mappings
    if (CONCEPT_MAP[word]) {
      CONCEPT_MAP[word].forEach((term) => expandedTerms.add(term));
    }

    // Check reverse mappings
    if (REVERSE_MAP.has(word)) {
      REVERSE_MAP.get(word)!.forEach((term) => expandedTerms.add(term));
    }

    // Check if word is part of any concept
    for (const [concept, related] of Object.entries(CONCEPT_MAP)) {
      if (concept.includes(word) || word.includes(concept)) {
        related.forEach((term) => expandedTerms.add(term));
      }
      for (const rel of related) {
        if (rel.includes(word) || word.includes(rel)) {
          expandedTerms.add(concept);
          related.forEach((term) => expandedTerms.add(term));
        }
      }
    }
  }

  // Remove original words and return unique expansions
  words.forEach((w) => expandedTerms.delete(w));
  return Array.from(expandedTerms);
}

function generateRelatedQueries(
  originalQuery: string,
  expansions: string[]
): string[] {
  const queries: string[] = [];
  const words = originalQuery.toLowerCase().split(/\s+/);

  // Replace each word with its expansions
  for (let i = 0; i < words.length; i++) {
    for (const expansion of expansions.slice(0, 3)) {
      // Limit to top 3 expansions per word
      const newWords = [...words];
      newWords[i] = expansion;
      queries.push(newWords.join(" "));
    }
  }

  // Add queries with appended expansions
  for (const expansion of expansions.slice(0, 3)) {
    queries.push(`${originalQuery} ${expansion}`);
    queries.push(`${expansion} ${originalQuery}`);
  }

  // Remove duplicates and original
  return [...new Set(queries)].filter(
    (q) => q.toLowerCase() !== originalQuery.toLowerCase()
  );
}

export const expandSearchTool: Tool = {
  name: "noverload_expand_search",
  description:
    "Intelligently expand search queries to find related content when original searches return few results. Uses concept mapping and semantic expansion.",
  inputSchema: {
    type: "object",
    properties: {
      originalQuery: {
        type: "string",
        description: "The original search query that returned few/no results",
      },
      noResultsFound: {
        type: "boolean",
        description: "Whether the original search returned no results",
        default: false,
      },
      context: {
        type: "string",
        description: "Additional context about what the user is looking for",
      },
      limit: {
        type: "number",
        description: "Maximum number of expanded queries to return",
        default: 5,
      },
    },
    required: ["originalQuery"],
  },
  modifies: false,

  handler: async (client: NoverloadClient, args: unknown) => {
    const input = inputSchema.parse(args);

    try {
      // Step 1: Expand concepts from the original query
      const conceptExpansions = expandConcepts(input.originalQuery);

      // Step 2: Generate related queries
      const expandedQueries = generateRelatedQueries(
        input.originalQuery,
        conceptExpansions
      );

      // Step 3: Determine search strategies based on context
      const strategies: string[] = [];

      if (input.noResultsFound) {
        strategies.push("Try broader terms");
        strategies.push("Check for typos or alternative spellings");
        strategies.push("Use category searches instead of specific terms");
      } else {
        strategies.push("Add more specific terms");
        strategies.push("Try related concepts");
        strategies.push("Search by content type");
      }

      // Step 4: Generate smart suggestions
      const suggestions: Array<{
        query: string;
        rationale: string;
        confidence: "high" | "medium" | "low";
      }> = [];

      // Add top expanded queries with rationale
      for (const query of expandedQueries.slice(0, input.limit)) {
        // Determine why this expansion might help
        let rationale = "Related concept that might have relevant content";
        let confidence: "high" | "medium" | "low" = "medium";

        // Check if this expansion is a direct concept mapping
        const queryWords = query.toLowerCase().split(/\s+/);
        for (const word of queryWords) {
          if (CONCEPT_MAP[word]) {
            rationale = `Expands to related ${word} concepts`;
            confidence = "high";
            break;
          }
        }

        suggestions.push({ query, rationale, confidence });
      }

      // Step 5: Try to understand intent and add specific suggestions
      const queryLower = input.originalQuery.toLowerCase();

      if (
        queryLower.includes("how") ||
        queryLower.includes("guide") ||
        queryLower.includes("tutorial")
      ) {
        suggestions.push({
          query: `${input.originalQuery} step by step`,
          rationale: "Looking for instructional content",
          confidence: "high",
        });
      }

      if (queryLower.includes("example") || queryLower.includes("case")) {
        suggestions.push({
          query: `${input.originalQuery} case study success story`,
          rationale: "Looking for real-world examples",
          confidence: "high",
        });
      }

      if (queryLower.includes("best") || queryLower.includes("top")) {
        suggestions.push({
          query: `${input.originalQuery} recommendations tips`,
          rationale: "Looking for curated advice",
          confidence: "medium",
        });
      }

      // Format response
      let responseText = `🔍 **Search Expansion for: "${input.originalQuery}"**\n\n`;

      if (input.noResultsFound) {
        responseText += `⚠️ Original search returned no results. Here are alternative searches:\n\n`;
      } else {
        responseText += `💡 Expanding your search to find more relevant content:\n\n`;
      }

      // Add expanded concepts
      if (conceptExpansions.length > 0) {
        responseText += `**Related Concepts Found:**\n`;
        responseText += `${conceptExpansions.slice(0, 10).join(", ")}\n\n`;
      }

      // Add suggested queries
      responseText += `**Suggested Searches:**\n\n`;
      for (const suggestion of suggestions.slice(0, input.limit)) {
        const icon =
          suggestion.confidence === "high"
            ? "🎯"
            : suggestion.confidence === "medium"
              ? "🔹"
              : "◽";
        responseText += `${icon} **"${suggestion.query}"**\n`;
        responseText += `   *${suggestion.rationale}*\n\n`;
      }

      // Add search strategies
      responseText += `**Search Strategies:**\n`;
      for (const strategy of strategies) {
        responseText += `- ${strategy}\n`;
      }

      // Add tips
      responseText += `\n**💡 Pro Tips:**\n`;
      responseText += `- Use quotes for exact phrases: "${input.originalQuery}"\n`;
      responseText += `- Try content type filters: YouTube, Articles, Reddit\n`;
      responseText += `- Search by tags or categories instead of keywords\n`;

      if (input.context) {
        responseText += `\n**Context considered:** ${input.context}\n`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        data: {
          originalQuery: input.originalQuery,
          expandedConcepts: conceptExpansions,
          suggestedQueries: suggestions,
          totalExpansions: expandedQueries.length,
          strategies: strategies,
        },
      };
    } catch (error) {
      console.error("Search expansion error:", error);

      return {
        content: [
          {
            type: "text",
            text: `❌ Error expanding search: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        error: true,
      };
    }
  },
};
