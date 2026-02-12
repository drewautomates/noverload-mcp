import { z } from "zod";
import { Tool } from "../types.js";
import { Content } from "../../client.js";

// Interfaces for synthesis API response
interface SynthesisInsight {
  insight?: string;
  text?: string;
  category?: string;
}

interface SynthesisTheme {
  theme: string;
  frequency: number;
  insight?: string;
}

interface SynthesisConnection {
  pattern?: string;
  concept?: string;
  implication?: string;
  strength?: string;
}

interface SynthesisData {
  // Various summary field names from API
  summary?: string;
  executiveSummary?: string;
  overview?: string;

  // Various insight field names from API
  insights?: (string | SynthesisInsight)[];
  actionableInsights?: SynthesisInsight[];
  keyInsights?: (string | SynthesisInsight)[];

  // Theme and connection data
  keyThemes?: SynthesisTheme[];
  themes?: SynthesisTheme[];
  connections?: (string | SynthesisConnection)[];
  patterns?: (string | SynthesisConnection)[];
  knowledgeGaps?: string[];
  gaps?: string[];

  // API metadata
  success?: boolean;
  sources?: unknown[];
  sourcesAnalyzed?: number;
}

// Search result extends Content with relevance score
interface SearchResult extends Content {
  relevanceScore?: number;
}

// Stop words to ignore when extracting topic keywords
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "and", "but", "or", "nor", "not", "so", "yet", "both",
  "each", "few", "more", "most", "other", "some", "such", "no",
  "only", "own", "same", "than", "too", "very", "just", "about",
  "how", "what", "which", "who", "whom", "this", "that", "these",
  "those", "am", "it", "its", "my", "your", "our", "their", "all",
  "any", "if", "up", "down", "here", "there", "when", "where", "why",
  "impact", "effect", "effects", "role", "using", "use",
]);

/**
 * Extract meaningful keywords from a topic string.
 * Returns lowercase terms with stop words removed.
 */
function extractTopicKeywords(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Check if a piece of text is relevant to the given topic keywords.
 * Returns true if the text contains at least one topic keyword.
 */
function isRelevantToTopic(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword));
}

export const exploreTopicTool: Tool = {
  name: "explore_topic",
  description: "Synthesize insights about a topic across multiple saved sources (~1-2k tokens). Returns cross-source themes, key insights, connections, and knowledge gaps. More token-efficient than fetching individual items. Use for research questions, finding patterns, or understanding a topic from multiple perspectives.",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The topic to explore comprehensively",
      },
      depth: {
        type: "string",
        enum: ["surface", "comprehensive", "expert"],
        description: "Depth of exploration",
        default: "comprehensive",
      },
      includeConnections: {
        type: "boolean",
        description: "Find connections to related topics",
        default: true,
      },
      maxSources: {
        type: "number",
        description: "Maximum number of sources to analyze",
        default: 20,
      },
    },
    required: ["topic"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      topic: z.string(),
      depth: z.enum(["surface", "comprehensive", "expert"]).optional().default("comprehensive"),
      includeConnections: z.boolean().optional().default(true),
      maxSources: z.number().optional().default(20),
    });
    const params = schema.parse(args);
    
    // Search for all content related to the topic
    const searchResults = await client.searchContent(params.topic, {
      limit: params.maxSources,
      enableConceptExpansion: true,
      fuzzyMatch: true,
    }) as SearchResult[];

    if (!searchResults || searchResults.length === 0) {
      const terms = params.topic.split(/\s+/).filter((t) => t.length > 2);
      let suggestions = `No content found for topic: "${params.topic}".\n\n`;
      suggestions += `**Suggestions:**\n`;
      suggestions += `- Try broader terms (e.g., "${terms[0] || params.topic}")\n`;
      suggestions += `- Use \`search_content\` with \`searchMode: "any"\` for looser matching\n`;
      suggestions += `- Use \`list_saved_content\` to browse what's available\n`;
      suggestions += `- Save relevant content first, then re-explore\n`;

      return {
        content: [
          {
            type: "text",
            text: suggestions,
          },
        ],
        data: null,
      };
    }

    // Synthesize the content for deep understanding
    // Note: "actionable" mode is the only one that properly uses ai_insights.frameworks
    // "overview" and "thematic" modes use processing_metadata.concepts which may be empty
    const synthesis = await client.synthesizeContent({
      query: `Comprehensive exploration of ${params.topic}`,
      contentIds: searchResults.slice(0, params.maxSources).map((r) => r.id),
      synthesisMode: params.depth === "surface" ? "overview" : "actionable",
      findConnections: params.includeConnections,
      findContradictions: true,
    });

    // Handle response format - synthesis might be nested or flat
    const synthData: SynthesisData = synthesis.synthesis || synthesis;

    // Debug: log the structure to understand what API returns
    console.error("[explore_topic] Synthesis response keys:", Object.keys(synthData));

    // Filter insights and frameworks for topic relevance
    // The synthesis API extracts ALL frameworks from matched sources, even off-topic ones
    const topicKeywords = extractTopicKeywords(params.topic);

    if (topicKeywords.length > 0) {
      const filterInsightArray = (arr: (string | SynthesisInsight)[]): (string | SynthesisInsight)[] => {
        return arr.filter((item) => {
          const text = typeof item === "string"
            ? item
            : (item.insight || item.text || "");
          return isRelevantToTopic(text, topicKeywords);
        });
      };

      if (synthData.insights) {
        synthData.insights = filterInsightArray(synthData.insights);
      }
      if (synthData.actionableInsights) {
        synthData.actionableInsights = synthData.actionableInsights.filter((item) => {
          const text = item.insight || item.text || "";
          return isRelevantToTopic(text, topicKeywords);
        });
      }
      if (synthData.keyInsights) {
        synthData.keyInsights = filterInsightArray(synthData.keyInsights);
      }
    }

    let responseText = `# 🔍 Topic Exploration: "${params.topic}"\n`;
    responseText += `**Depth:** ${params.depth} | **Sources Analyzed:** ${searchResults.length}\n\n`;

    // Overview Section - check multiple possible field names
    const overviewText = synthData.summary || synthData.executiveSummary || synthData.overview;
    responseText += `## 📋 Overview\n`;
    if (overviewText && !overviewText.includes("0 insights")) {
      // Only use API summary if it's meaningful
      responseText += `${overviewText}\n\n`;
    } else {
      // Generate a basic overview from search results
      const contentTypes = [...new Set(searchResults.map(r => r.contentType))];
      responseText += `Found ${searchResults.length} pieces of content about "${params.topic}" `;
      responseText += `(${contentTypes.join(", ")}).\n\n`;
    }

    // Key Insights - check multiple possible field names
    const insights = synthData.insights || synthData.actionableInsights || synthData.keyInsights || [];
    if (insights.length > 0) {
      responseText += `## 💡 Key Insights\n`;
      insights.slice(0, 10).forEach((insight, idx) => {
        if (typeof insight === 'string') {
          responseText += `${idx + 1}. ${insight}\n`;
        } else if (insight.insight) {
          // Format from actionableInsights
          responseText += `${idx + 1}. **${insight.insight}**`;
          if (insight.category) {
            responseText += ` *(${insight.category})*`;
          }
          responseText += `\n`;
        } else if (insight.text) {
          responseText += `${idx + 1}. ${insight.text}\n`;
        }
      });
      responseText += `\n`;
    } else {
      // Fallback: extract key points from content summaries
      responseText += `## 💡 Content Summaries\n`;
      searchResults.slice(0, 5).forEach((result, idx) => {
        if (result.summary) {
          const summaryText = typeof result.summary === 'string'
            ? result.summary
            : (result.summary as { one_sentence?: string; text?: string }).one_sentence
              || (result.summary as { one_sentence?: string; text?: string }).text
              || '';
          if (summaryText) {
            responseText += `${idx + 1}. **${result.title || 'Untitled'}**: ${summaryText.slice(0, 200)}${summaryText.length > 200 ? '...' : ''}\n`;
          }
        }
      });
      responseText += `\n`;
    }

    // Key Themes (from enhanced synthesis)
    const themes = synthData.keyThemes || synthData.themes || [];
    if (themes.length > 0) {
      responseText += `## 🎨 Key Themes\n`;
      themes.slice(0, 5).forEach((theme, idx) => {
        responseText += `${idx + 1}. **${theme.theme}** (${theme.frequency} sources)\n`;
        if (theme.insight) {
          responseText += `   - ${theme.insight}\n`;
        }
      });
      responseText += `\n`;
    }

    // Connections (if found) - check multiple possible field names
    const connections = synthData.connections || synthData.patterns || [];
    if (params.includeConnections && connections.length > 0) {
      responseText += `## 🔗 Related Topics & Connections\n`;
      connections.slice(0, 8).forEach((conn) => {
        if (typeof conn === 'string') {
          responseText += `- ${conn}\n`;
        } else if (conn.pattern) {
          // Format from enhanced synthesis
          responseText += `- **${conn.pattern}**`;
          if (conn.implication) {
            responseText += `: ${conn.implication}`;
          }
          responseText += `\n`;
        } else if (conn.concept) {
          responseText += `- **${conn.concept}**`;
          if (conn.strength) {
            responseText += ` (strength: ${conn.strength})`;
          }
          responseText += `\n`;
        }
      });
      responseText += `\n`;
    }

    // Knowledge Gaps
    const knowledgeGaps = synthData.knowledgeGaps || synthData.gaps || [];
    if (knowledgeGaps.length > 0) {
      responseText += `## ❓ Areas to Explore Further\n`;
      knowledgeGaps.slice(0, 5).forEach((gap) => {
        responseText += `- ${gap}\n`;
      });
      responseText += `\n`;
    }

    // Sources
    responseText += `## 📚 Top Sources\n`;
    const typeIcons: Record<string, string> = {
      youtube: "📺",
      x_twitter: "𝕏",
      reddit: "🔗",
      article: "📄",
      pdf: "📑"
    };
    searchResults.slice(0, 5).forEach((source, idx) => {
      const icon = typeIcons[source.contentType] || "📄";
      responseText += `${idx + 1}. ${icon} [${source.title || "Untitled"}](${source.url})\n`;
    });
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        topic: params.topic,
        depth: params.depth,
        sourcesAnalyzed: searchResults.length,
        synthesis: synthData,
        sources: searchResults,
      },
    };
  },
};