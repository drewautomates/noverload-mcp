import { Tool } from "../types.js";

export const listGoalsTool: Tool = {
  name: "list_goals",
  description: "List user's goals (Health, Wealth, Relationships)",
  inputSchema: {
    type: "object",
    properties: {},
  },
  modifies: false,
  handler: async (client) => {
    const goals = await client.listGoals();
    return {
      content: [
        {
          type: "text",
          text: `Found ${goals.length} goals`,
        },
      ],
      data: goals,
    };
  },
};