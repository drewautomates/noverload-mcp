import { z } from "zod";
import { Tool } from "../types.js";

export const listConceptsTool: Tool = {
  name: "list_concepts",
  description:
    "List your AI-compiled concept pages (personal wiki). Each concept synthesizes insights from multiple saved sources into a structured article. Returns titles, descriptions, source counts, and compilation status. Use this to discover what concepts exist before diving deeper with get_concept.",
  inputSchema: {
    type: "object",
    properties: {
      search: {
        type: "string",
        description: "Search concepts by title or description",
      },
      status: {
        type: "string",
        enum: ["draft", "published", "stale"],
        description: "Filter by compilation status",
      },
      limit: {
        type: "number",
        description: "Maximum concepts to return (default: 20)",
        default: 20,
      },
    },
    required: [],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      search: z.string().optional(),
      status: z.enum(["draft", "published", "stale"]).optional(),
      limit: z.number().optional().default(20),
    });
    const params = schema.parse(args);

    const concepts = await client.listConcepts({
      search: params.search,
      status: params.status,
      limit: params.limit,
    });

    if (!concepts || concepts.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No concept pages found${params.search ? ` matching "${params.search}"` : ""}.\n\n**Tip:** Concept pages are auto-generated when you have 3+ sources about the same topic. Save more content to build your personal wiki!`,
          },
        ],
        data: null,
      };
    }

    const statusIcons: Record<string, string> = {
      draft: "📝",
      published: "✅",
      stale: "⏳",
    };

    let responseText = `# 📚 Your Concept Pages (${concepts.length})\n\n`;

    concepts.forEach((concept, idx) => {
      const icon = statusIcons[concept.status] ?? "📄";
      responseText += `${idx + 1}. ${icon} **${concept.title}**`;
      if (concept.description) {
        responseText += ` — ${concept.description}`;
      }
      responseText += `\n`;
      responseText += `   ${concept.sourceCount} sources | v${concept.compilationVersion}`;
      if (concept.lastCompiledAt) {
        responseText += ` | compiled ${new Date(concept.lastCompiledAt).toLocaleDateString()}`;
      }
      responseText += ` | slug: \`${concept.slug}\`\n\n`;
    });

    responseText += `\n**Use \`get_concept\` with a slug to read the full compiled article.**`;

    return {
      content: [{ type: "text", text: responseText }],
      data: { concepts, total: concepts.length },
    };
  },
};
