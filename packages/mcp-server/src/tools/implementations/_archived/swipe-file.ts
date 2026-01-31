import { z } from "zod";
import { Tool } from "../types.js";

export const markAsSwipeFileTool: Tool = {
  name: "mark_as_swipe_file",
  description:
    "Mark existing content as a swipe file reference. This triggers AI analysis to detect craft elements (hooks, CTAs, storytelling, etc.) and automatically adds relevant swipe file tags.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "The ID of the content to mark as swipe file",
      },
    },
    required: ["contentId"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string().uuid(),
    });

    const params = schema.parse(args);
    const result = await client.markAsSwipeFile(params.contentId);

    let responseText = `# Swipe File Analysis\n\n`;
    responseText += `**Content:** ${result.contentTitle || params.contentId}\n\n`;

    if (result.tagsAdded && result.tagsAdded.length > 0) {
      responseText += `## Craft Elements Detected\n\n`;
      for (const tag of result.tagsAdded) {
        responseText += `### ${tag.name} (${Math.round(tag.confidence * 100)}% confidence)\n`;
        responseText += `${tag.reason}\n\n`;
      }
    } else {
      responseText += `No specific craft elements detected, but content is now marked as swipe file.\n`;
      responseText += `You can manually add tags using \`add_tags\`.\n\n`;
    }

    responseText += `---\n`;
    responseText += `**Status:** Marked as swipe file\n`;
    responseText += `**Craft tags added:** ${result.totalTags || 0}\n\n`;
    responseText += `Use \`search_content\` with tags like \`["great-hook"]\` to find this later.`;

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: result,
    };
  },
};

export const unmarkSwipeFileTool: Tool = {
  name: "unmark_swipe_file",
  description:
    "Remove the swipe file designation from content. The craft tags will be preserved but the content won't show as a swipe file item.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "The ID of the content to unmark",
      },
    },
    required: ["contentId"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string().uuid(),
    });

    const params = schema.parse(args);
    const result = await client.unmarkAsSwipeFile(params.contentId);

    const responseText = `Removed swipe file designation from content.\n\nNote: Any craft tags (great-hook, storytelling, etc.) are still attached and can be used for filtering.`;

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: result,
    };
  },
};
