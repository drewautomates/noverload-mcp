import { z } from "zod";
import { Tool } from "../types.js";

export const addTagsTool: Tool = {
  name: "add_tags",
  description:
    "Add one or more tags to a saved content item. Tags help organize content for later retrieval (e.g., 'swipe-file', 'great-hook', 'copywriting'). If a tag doesn't exist, it will be created automatically.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "The ID of the content to tag",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Tag names to add (e.g., ['swipe-file', 'copywriting']). Tags will be created if they don't exist.",
        minItems: 1,
        maxItems: 10,
      },
    },
    required: ["contentId", "tags"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string().uuid(),
      tags: z.array(z.string().min(1).max(50)).min(1).max(10),
    });

    const params = schema.parse(args);
    const result = await client.addTagsToContent(params.contentId, params.tags);

    let responseText = `# Tags Added\n\n`;

    if (result.addedTags.length > 0) {
      responseText += `**Content ID:** \`${result.contentId}\`\n\n`;
      responseText += `## Added Tags\n`;
      for (const tag of result.addedTags) {
        const createdLabel = tag.created ? " (new)" : "";
        responseText += `- \`${tag.name}\`${createdLabel}\n`;
      }
    }

    if (result.errors && result.errors.length > 0) {
      responseText += `\n## Errors\n`;
      for (const error of result.errors) {
        responseText += `- ${error}\n`;
      }
    }

    responseText += `\n---\n`;
    responseText += `Tip: Use \`search_content\` with \`tags: ["${params.tags[0]}"]\` to find content with this tag.`;

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

export const removeTagsTool: Tool = {
  name: "remove_tags",
  description: "Remove one or more tags from a saved content item.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "The ID of the content to remove tags from",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tag names to remove",
        minItems: 1,
        maxItems: 10,
      },
    },
    required: ["contentId", "tags"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string().uuid(),
      tags: z.array(z.string().min(1).max(50)).min(1).max(10),
    });

    const params = schema.parse(args);
    const result = await client.removeTagsFromContent(params.contentId, params.tags);

    let responseText = `# Tags Removed\n\n`;

    if (result.removedTags.length > 0) {
      responseText += `**Content ID:** \`${result.contentId}\`\n\n`;
      responseText += `## Removed Tags\n`;
      for (const tag of result.removedTags) {
        responseText += `- \`${tag}\`\n`;
      }
    } else {
      responseText += `No tags were removed.\n`;
    }

    if (result.errors && result.errors.length > 0) {
      responseText += `\n## Errors\n`;
      for (const error of result.errors) {
        responseText += `- ${error}\n`;
      }
    }

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

export const createTagTool: Tool = {
  name: "create_tag",
  description:
    "Create a new custom tag for organizing content. Use this to create tags before using them, or let add_tags create them automatically.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "The name of the tag to create (e.g., 'swipe-file', 'great-hook')",
      },
    },
    required: ["name"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      name: z.string().min(1).max(50),
    });

    const params = schema.parse(args);
    const result = await client.createTag(params.name);

    let responseText = `# Tag ${result.tag.isNew ? "Created" : "Found"}\n\n`;
    responseText += `**Name:** \`${result.tag.name}\`\n`;
    responseText += `**Slug:** \`${result.tag.slug}\`\n`;
    responseText += `**ID:** \`${result.tag.id}\`\n`;

    if (!result.tag.isNew) {
      responseText += `\n*This tag already exists.*\n`;
    }

    responseText += `\n---\n`;
    responseText += `Use this tag with:\n`;
    responseText += `- \`add_tags\` to tag content\n`;
    responseText += `- \`search_content\` with \`tags: ["${result.tag.name}"]\` to filter\n`;
    responseText += `- \`save_content\` with \`tags: ["${result.tag.name}"]\` to tag on save\n`;

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
