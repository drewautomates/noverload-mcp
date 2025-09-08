import { z } from "zod";
import { Tool } from "../types.js";

export const listActionsTool: Tool = {
  name: "list_actions",
  description: "List action items extracted from saved content",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "Filter by content ID",
      },
      goalId: {
        type: "string",
        description: "Filter by goal ID",
      },
      completed: {
        type: "boolean",
        description: "Filter by completion status",
      },
    },
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      contentId: z.string().optional(),
      goalId: z.string().optional(),
      completed: z.boolean().optional(),
    });
    const params = schema.parse(args);
    const actions = await client.listActions(params);
    return {
      content: [
        {
          type: "text",
          text: `Found ${actions.length} actions`,
        },
      ],
      data: actions,
    };
  },
};

export const completeActionTool: Tool = {
  name: "complete_action",
  description: "Mark an action item as completed",
  inputSchema: {
    type: "object",
    properties: {
      actionId: {
        type: "string",
        description: "The ID of the action to complete",
      },
    },
    required: ["actionId"],
  },
  modifies: true,
  handler: async (client, args) => {
    const schema = z.object({
      actionId: z.string(),
    });
    const { actionId } = schema.parse(args);
    const action = await client.completeAction(actionId);
    return {
      content: [
        {
          type: "text",
          text: `Completed action: ${action.title}`,
        },
      ],
      data: action,
    };
  },
};