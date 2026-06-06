import { z } from "zod";
import { Tool } from "../types.js";
import { Content } from "../../client.js";

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
  description: `Pull structured synthesis MATERIAL across saved sources on a topic (~1–2k tokens, vs 20k+ for raw content). Returns substrate for YOU to synthesize — not a finished answer.

Returns:
  • Insights — attributed, confidence-ranked takeaways pulled from the matched sources
  • Contradiction candidates — heuristic flags where two sources may disagree (verify before trusting)
  • Themes — recurring concepts with real distinct-source counts (e.g., "first-principles — 4 sources")
  • Frameworks — named methodologies present, with step counts (call extract_frameworks for full steps)
  • Sources & excerpts — each matched item with a key excerpt + any relationship tag

After calling this, synthesize the material into a direct answer: weigh the contradictions, connect insights across sources, and name gaps the saves don't cover. Use for: "what do my saves collectively say about X", competitive landscape mapping, finding contrarian/open lanes, research spanning >1 source. Call get_content_details only if you need exact quotes after. Pass folderId (from list_folders) to scope to a single folder.`,
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
      folderId: {
        type: "string",
        description:
          "Optional: scope the exploration to one of the user's folders. Accepts the folder name (e.g. \"ORB\") or its id from list_folders. Synthesizes the topic across only that folder's content.",
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
      folderId: z.string().optional(),
      maxSources: z.number().optional().default(20),
    });
    const params = schema.parse(args);

    // Gather candidate sources. When scoped to a folder, the folder IS the scope:
    // pull its contents and rank by topic relevance rather than searching globally.
    // Otherwise, use semantic search across the whole library.
    let searchResults: SearchResult[];
    if (params.folderId) {
      // Accept a folder name or UUID; the API filter needs a UUID.
      const resolvedFolderId = await client.resolveFolderId(params.folderId);
      const folderKeywords = extractTopicKeywords(params.topic);
      const folderContent = (await client.listContent({
        folderId: resolvedFolderId,
        limit: 100,
      })) as SearchResult[];

      // Prefer items whose title/summary match the topic, but keep the rest so a
      // vague topic ("explore my ORB folder") still synthesizes the whole folder.
      const scored = folderContent.map((item) => {
        const summaryText =
          typeof item.summary === "string"
            ? item.summary
            : ((item.summary as { one_sentence?: string; text?: string } | null)?.one_sentence ??
               (item.summary as { one_sentence?: string; text?: string } | null)?.text ??
               "");
        const haystack = `${item.title ?? ""} ${summaryText}`;
        const matches =
          folderKeywords.length === 0 || isRelevantToTopic(haystack, folderKeywords);
        return { item, matches };
      });
      searchResults = [
        ...scored.filter((s) => s.matches).map((s) => s.item),
        ...scored.filter((s) => !s.matches).map((s) => s.item),
      ].slice(0, params.maxSources);
    } else {
      // Search for all content related to the topic
      searchResults = (await client.searchContent(params.topic, {
        limit: params.maxSources,
        enableConceptExpansion: true,
        fuzzyMatch: true,
      })) as SearchResult[];
    }

    if (!searchResults || searchResults.length === 0) {
      const terms = params.topic.split(/\s+/).filter((t) => t.length > 2);
      let suggestions = params.folderId
        ? `No content found in that folder for topic: "${params.topic}".\n\n`
        : `No content found for topic: "${params.topic}".\n\n`;
      suggestions += `**Suggestions:**\n`;
      if (params.folderId) {
        suggestions += `- The folder may be empty — check with \`list_folders\` or \`list_saved_content\` (folderId)\n`;
        suggestions += `- Remove folderId to explore across your whole library\n`;
      }
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

    // Fetch structured synthesis SUBSTRATE (not templated prose). The user's LLM
    // is on the other end of MCP, so we hand it clean material to synthesize from
    // rather than paying a server LLM to pre-write text it would re-read.
    const substrateResponse = await client.getSubstrate({
      query: params.topic,
      contentIds: searchResults.slice(0, params.maxSources).map((r) => r.id),
      maxSources: params.maxSources,
      allowRecentFallback: false,
      focusAreas: [params.topic],
    });

    const substrate = substrateResponse.substrate;
    if (!substrate) {
      return {
        content: [
          {
            type: "text",
            text:
              substrateResponse.error ||
              `Could not assemble synthesis material for "${params.topic}".`,
          },
        ],
        data: null,
      };
    }

    // The synthesis endpoint extracts insights/frameworks from ALL matched
    // sources, even off-topic ones. Filter to the topic client-side.
    const topicKeywords = extractTopicKeywords(params.topic);
    const insights =
      topicKeywords.length > 0
        ? substrate.insights.filter((i) => isRelevantToTopic(i.text, topicKeywords))
        : substrate.insights;
    const frameworks =
      topicKeywords.length > 0
        ? substrate.frameworks.filter((f) =>
            isRelevantToTopic(`${f.name} ${f.description}`, topicKeywords)
          )
        : substrate.frameworks;

    const typeIcons: Record<string, string> = {
      youtube: "📺",
      x_twitter: "𝕏",
      reddit: "🔗",
      article: "📄",
      pdf: "📑",
    };

    let responseText = `# 🔍 Synthesis material: "${params.topic}"\n`;
    responseText += `**Sources analyzed:** ${substrate.sourcesAnalyzed}\n\n`;
    responseText +=
      `> This is structured *substrate*, not a finished answer. Synthesize it into a ` +
      `direct response to the user's question: weigh the contradiction candidates, ` +
      `connect insights across sources, and call out any gaps the saved content doesn't cover.\n\n`;

    // Insights — attributed, ranked by confidence.
    if (insights.length > 0) {
      responseText += `## 💡 Insights (${insights.length})\n`;
      insights.forEach((i, idx) => {
        responseText += `${idx + 1}. ${i.text} — *${i.sourceTitle}* (conf ${(i.confidence * 100).toFixed(0)}%)\n`;
      });
      responseText += `\n`;
    }

    // Contradiction candidates — the cross-source tension to resolve.
    if (substrate.contradictionCandidates.length > 0) {
      responseText += `## ⚔️ Contradiction candidates (${substrate.contradictionCandidates.length})\n`;
      responseText += `*Heuristic flags — verify before trusting; the sources may not truly conflict.*\n`;
      substrate.contradictionCandidates.forEach((c, idx) => {
        responseText += `${idx + 1}. **${c.sourceA}:** ${c.claimA}\n`;
        responseText += `   ↔ **${c.sourceB}:** ${c.claimB}\n`;
      });
      responseText += `\n`;
    }

    // Themes — real distinct-source counts.
    if (substrate.themes.length > 0) {
      responseText += `## 🎨 Themes\n`;
      substrate.themes.forEach((t) => {
        responseText += `- **${t.theme}** — ${t.sourceCount} source${t.sourceCount === 1 ? "" : "s"}\n`;
      });
      responseText += `\n`;
    }

    // Frameworks — surfaced with step counts; extract_frameworks returns full steps.
    if (frameworks.length > 0) {
      responseText += `## 🧩 Frameworks (${frameworks.length})\n`;
      frameworks.forEach((f) => {
        const stepNote = f.steps.length > 0 ? ` (${f.steps.length} steps)` : "";
        responseText += `- **${f.name}**${stepNote} — *${f.sourceTitle}*\n`;
      });
      responseText += `*Call extract_frameworks for full step-by-step detail.*\n\n`;
    }

    // Source relationships — excerpt + any deterministic relationship tag.
    if (substrate.sourceRelationships.length > 0) {
      responseText += `## 📚 Sources & excerpts\n`;
      substrate.sourceRelationships.forEach((s, idx) => {
        const icon = typeIcons[s.type] || "📄";
        const relTag = s.relationship ? ` \`${s.relationship}\`` : "";
        responseText += `${idx + 1}. ${icon} [${s.title || "Untitled"}](${s.url})${relTag}\n`;
        if (s.excerpt) {
          responseText += `   > ${s.excerpt.slice(0, 280)}${s.excerpt.length > 280 ? "…" : ""}\n`;
        }
      });
      responseText += `\n`;
    }

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
        sourcesAnalyzed: substrate.sourcesAnalyzed,
        substrate: { ...substrate, insights, frameworks },
        sources: searchResults,
      },
    };
  },
};