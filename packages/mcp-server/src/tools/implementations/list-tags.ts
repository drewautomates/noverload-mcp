import { z } from "zod";
import { Tool } from "../types.js";

export const listTagsTool: Tool = {
  name: "list_tags",
  description:
    "List all available tags for organizing content. Returns both system tags (pre-defined categories) and custom tags (user-created). Use this to see what tags exist before adding tags to content or filtering searches.",
  inputSchema: {
    type: "object",
    properties: {
      showUsage: {
        type: "boolean",
        description:
          "Include usage counts showing how many content items have each tag",
        default: true,
      },
      filter: {
        type: "string",
        enum: ["all", "system", "custom"],
        description:
          "Filter to show all tags, only system tags, or only custom tags",
        default: "all",
      },
    },
    required: [],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      showUsage: z.boolean().optional().default(true),
      filter: z.enum(["all", "system", "custom"]).optional().default("all"),
    });

    const params = schema.parse(args);
    const tagsResponse = await client.listTags();

    // Filter based on preference
    let displayTags = tagsResponse.tags;
    if (params.filter === "system") {
      displayTags = tagsResponse.grouped?.system || tagsResponse.tags.filter((t) => t.isSystem);
    } else if (params.filter === "custom") {
      displayTags = tagsResponse.grouped?.custom || tagsResponse.tags.filter((t) => !t.isSystem);
    }

    // Sort by usage count if showing usage, otherwise alphabetically
    if (params.showUsage) {
      displayTags = [...displayTags].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    } else {
      displayTags = [...displayTags].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Build response text
    let responseText = `# Available Tags\n\n`;

    if (params.filter === "all") {
      responseText += `**Total:** ${tagsResponse.total} tags (${tagsResponse.grouped?.system.length || 0} system, ${tagsResponse.grouped?.custom.length || 0} custom)\n\n`;
    } else {
      responseText += `**Showing:** ${displayTags.length} ${params.filter} tags\n\n`;
    }

    if (displayTags.length === 0) {
      responseText += `No ${params.filter === "all" ? "" : params.filter + " "}tags found.\n`;
      responseText += `\nTip: Use \`create_tag\` to create custom tags for organizing your content.`;
    } else {
      // Group by category for system tags
      if (params.filter !== "custom") {
        const byCategory = new Map<string, typeof displayTags>();

        for (const tag of displayTags) {
          const category = tag.category || (tag.isSystem ? "Uncategorized" : "Custom");
          if (!byCategory.has(category)) {
            byCategory.set(category, []);
          }
          byCategory.get(category)!.push(tag);
        }

        // Sort categories
        const sortedCategories = [...byCategory.entries()].sort((a, b) => {
          // Custom category goes last
          if (a[0] === "Custom") return 1;
          if (b[0] === "Custom") return -1;
          return a[0].localeCompare(b[0]);
        });

        for (const [category, categoryTags] of sortedCategories) {
          responseText += `## ${category}\n`;
          for (const tag of categoryTags) {
            const usageText = params.showUsage && tag.usageCount ? ` (${tag.usageCount})` : "";
            const typeIcon = tag.isSystem ? "🔵" : "🟢";
            responseText += `${typeIcon} \`${tag.name}\`${usageText}\n`;
          }
          responseText += `\n`;
        }
      } else {
        // Just list custom tags
        responseText += `## Your Custom Tags\n`;
        for (const tag of displayTags) {
          const usageText = params.showUsage && tag.usageCount ? ` (${tag.usageCount})` : "";
          responseText += `🟢 \`${tag.name}\`${usageText}\n`;
        }
      }

      responseText += `---\n`;
      responseText += `🔵 = System tag (AI-assigned) | 🟢 = Custom tag (user-created)\n`;
      responseText += `\nTip: Use \`search_content\` with \`tags\` parameter to filter content by tags.`;
    }

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        tags: displayTags,
        total: displayTags.length,
        systemCount: tagsResponse.grouped?.system.length || 0,
        customCount: tagsResponse.grouped?.custom.length || 0,
      },
    };
  },
};
