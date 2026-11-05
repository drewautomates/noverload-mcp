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
    let text = `# Your Goals\n\nFound ${goals.length} goal${goals.length === 1 ? "" : "s"}\n\n`;
    for (const goal of goals) {
      text += `## ${goal.title}\n`;
      text += `**ID:** \`${goal.id}\` | **Category:** ${goal.category} | **Status:** ${goal.isActive ? "active" : "inactive"}\n`;
      if (goal.description) text += `${goal.description}\n`;
      text += `\n`;
    }
    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
      data: goals,
    };
  },
};