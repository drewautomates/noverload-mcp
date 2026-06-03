import { z } from "zod";
import { Tool } from "../types.js";

export const listFoldersTool: Tool = {
  name: "list_folders",
  description:
    "List the user's custom folders for organizing saved content. Folders are user-created collections (each with an optional icon, color, and description) that group related sources. Returns each folder with how many content items it holds. Use this to understand how the user has organized their library before browsing or searching within a specific area.",
  inputSchema: {
    type: "object",
    properties: {
      showCounts: {
        type: "boolean",
        description:
          "Include content counts showing how many items are in each folder",
        default: true,
      },
    },
    required: [],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      showCounts: z.boolean().optional().default(true),
    });

    const params = schema.parse(args);
    const foldersResponse = await client.listFolders();

    // Sort by content count when showing counts, otherwise by sort order then name
    const folders = [...foldersResponse.folders].sort((a, b) => {
      if (params.showCounts) {
        return (b.contentCount || 0) - (a.contentCount || 0);
      }
      const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });

    // Build response text
    let responseText = `# Your Folders\n\n`;
    responseText += `**Total:** ${foldersResponse.total} folder${foldersResponse.total === 1 ? "" : "s"}\n\n`;

    if (folders.length === 0) {
      responseText += `No folders found.\n`;
      responseText += `\nTip: Create folders in the Noverload app to group related content.`;
    } else {
      for (const folder of folders) {
        const icon = folder.icon || "📁";
        const countText =
          params.showCounts ? ` (${folder.contentCount || 0})` : "";
        responseText += `${icon} **${folder.name}**${countText}\n`;
        if (folder.description) {
          responseText += `   ${folder.description}\n`;
        }
      }

      responseText += `\n---\n`;
      responseText += `Tip: Use \`list_saved_content\` or \`search_content\` to browse content, then reference these folders when organizing.`;
    }

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        folders,
        total: foldersResponse.total,
      },
    };
  },
};
