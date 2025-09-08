import { z } from "zod";
import { Tool } from "../types.js";

export const saveContentTool: Tool = {
  name: "save_content",
  description: "Save a new URL to Noverload for processing",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to save (YouTube, X/Twitter, Reddit, article, or PDF)",
      },
    },
    required: ["url"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      url: z.string().url(),
    });
    const { url } = schema.parse(args);
    const content = await client.saveContent(url);
    return {
      content: [
        {
          type: "text",
          text: content.title ? `Saved: ${content.title}` : `Saved content from: ${new URL(url).hostname}`,
        },
      ],
      data: content,
    };
  },
};