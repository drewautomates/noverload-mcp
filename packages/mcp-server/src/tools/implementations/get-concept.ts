import { z } from "zod";
import { Tool } from "../types.js";

export const getConceptTool: Tool = {
  name: "get_concept",
  description:
    "Get the full content of an AI-compiled concept page from your personal wiki. Returns the compiled markdown article, key insights, frameworks, contradictions, knowledge gaps, linked sources with relationships, and connected concepts. Use list_concepts first to find available slugs.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description:
          "The concept slug (URL identifier). Get this from list_concepts.",
      },
    },
    required: ["slug"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      slug: z.string(),
    });
    const params = schema.parse(args);

    const concept = await client.getConceptDetails(params.slug);

    if (!concept) {
      return {
        content: [
          {
            type: "text",
            text: `Concept page "${params.slug}" not found. Use \`list_concepts\` to see available concepts.`,
          },
        ],
        data: null,
      };
    }

    const summary = concept.summary as {
      overview?: string;
      key_insights?: string[];
      frameworks?: Array<{ name: string; steps: string[] }>;
      contradictions?: Array<{
        claim_a: string;
        claim_b: string;
      }>;
      gaps?: string[];
      consensus?: string[];
    } | null;

    let responseText = `# 📖 ${concept.title}\n`;
    responseText += `**Status:** ${concept.status} | **Sources:** ${concept.sourceCount} | **Version:** v${concept.compilationVersion}\n`;
    if (concept.lastCompiledAt) {
      responseText += `**Last compiled:** ${new Date(concept.lastCompiledAt).toLocaleDateString()}\n`;
    }
    responseText += `\n`;

    // Overview
    if (summary?.overview) {
      responseText += `## Overview\n${summary.overview}\n\n`;
    }

    // Key Insights
    if (summary?.key_insights && summary.key_insights.length > 0) {
      responseText += `## 💡 Key Insights\n`;
      summary.key_insights.forEach((insight, i) => {
        responseText += `${i + 1}. ${insight}\n`;
      });
      responseText += `\n`;
    }

    // Full compiled content
    if (concept.content) {
      responseText += `## 📝 Compiled Article\n${concept.content}\n\n`;
    }

    // Frameworks
    if (summary?.frameworks && summary.frameworks.length > 0) {
      responseText += `## 🔧 Frameworks & Methodologies\n`;
      summary.frameworks.forEach((fw) => {
        responseText += `### ${fw.name}\n`;
        fw.steps.forEach((step, i) => {
          responseText += `${i + 1}. ${step}\n`;
        });
        responseText += `\n`;
      });
    }

    // Contradictions
    if (summary?.contradictions && summary.contradictions.length > 0) {
      responseText += `## ⚠️ Contradictions\n`;
      summary.contradictions.forEach((c) => {
        responseText += `- **Claim A:** ${c.claim_a}\n  **Claim B:** ${c.claim_b}\n\n`;
      });
    }

    // Knowledge Gaps
    if (summary?.gaps && summary.gaps.length > 0) {
      responseText += `## ❓ Knowledge Gaps\n`;
      summary.gaps.forEach((gap) => {
        responseText += `- ${gap}\n`;
      });
      responseText += `\n`;
    }

    // Consensus
    if (summary?.consensus && summary.consensus.length > 0) {
      responseText += `## ✅ Consensus Points\n`;
      summary.consensus.forEach((point) => {
        responseText += `- ${point}\n`;
      });
      responseText += `\n`;
    }

    // Sources
    if (concept.sources && concept.sources.length > 0) {
      const typeIcons: Record<string, string> = {
        youtube: "📺",
        x_twitter: "𝕏",
        reddit: "🔗",
        article: "📄",
        pdf: "📑",
      };

      responseText += `## 📚 Sources (${concept.sources.length})\n`;
      concept.sources.forEach((source, i) => {
        const icon = typeIcons[source.type] ?? "📄";
        responseText += `${i + 1}. ${icon} [${source.title ?? "Untitled"}](${source.url})`;
        responseText += ` — *${source.relationship}*`;
        if (source.excerpt) {
          responseText += `\n   > ${source.excerpt}`;
        }
        responseText += `\n`;
      });
      responseText += `\n`;
    }

    // Connected concepts
    if (concept.connections && concept.connections.length > 0) {
      responseText += `## 🔗 Related Concepts\n`;
      concept.connections.forEach((conn) => {
        responseText += `- **${conn.conceptTitle}** (${conn.relationship}`;
        if (conn.strength) {
          responseText += `, ${(Number(conn.strength) * 100).toFixed(0)}% match`;
        }
        responseText += `) — slug: \`${conn.conceptSlug}\`\n`;
      });
    }

    return {
      content: [{ type: "text", text: responseText }],
      data: concept,
    };
  },
};
