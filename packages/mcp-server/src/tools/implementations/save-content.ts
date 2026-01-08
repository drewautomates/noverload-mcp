import { z } from "zod";
import { Tool } from "../types.js";

export const saveContentTool: Tool = {
  name: "save_content",
  description:
    "Save a new URL to Noverload for processing. Optionally mark as swipe file to trigger craft analysis (hooks, CTAs, storytelling detection).",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to save (YouTube, X/Twitter, Reddit, article, or PDF)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional tags to add immediately (e.g., ['copywriting', 'marketing']). Tags will be created if they don't exist.",
      },
      isSwipeFile: {
        type: "boolean",
        description:
          "Mark as swipe file to trigger craft analysis (detects hooks, CTAs, storytelling, etc.). Analysis runs after content is processed.",
      },
    },
    required: ["url"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      url: z.string().url(),
      tags: z.array(z.string().min(1).max(50)).optional(),
      isSwipeFile: z.boolean().optional(),
    });
    const { url, tags, isSwipeFile } = schema.parse(args);
    const content = await client.saveContent(url);

    let responseText = content.title
      ? `Saved: ${content.title}`
      : `Saved content from: ${new URL(url).hostname}`;

    // If tags provided, add them to the content
    let addedTags: string[] = [];
    if (tags && tags.length > 0 && content.id) {
      try {
        const tagResult = await client.addTagsToContent(content.id, tags);
        addedTags = tagResult.addedTags.map((t) => t.name);
        if (addedTags.length > 0) {
          responseText += `\n\nTags added: ${addedTags.map((t) => `\`${t}\``).join(", ")}`;
        }
      } catch (error) {
        responseText += `\n\n(Note: Failed to add tags, but content was saved)`;
      }
    }

    // If marked as swipe file, note that analysis will run after processing
    let swipeFileStatus = null;
    if (isSwipeFile && content.id) {
      responseText += `\n\n**Swipe File:** Content will be analyzed for craft elements (hooks, CTAs, storytelling) once processing completes.`;
      responseText += `\nUse \`mark_as_swipe_file\` after processing to trigger the analysis, or it will run automatically.`;
      swipeFileStatus = "pending_analysis";
    }

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        ...content,
        addedTags,
        swipeFileStatus,
      },
    };
  },
};