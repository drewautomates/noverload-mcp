import { z } from "zod";
import { Tool } from "../types.js";
import { planQueryStrategy, estimateTokenUsage } from "../../llm-instructions.js";

export const planQueryTool: Tool = {
  name: "plan_query",
  description: "Plan an optimal query strategy for complex requests, with token estimates",
  inputSchema: {
    type: "object",
    properties: {
      request: {
        type: "string",
        description: "The user's request to plan for",
      },
    },
    required: ["request"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      request: z.string(),
    });
    const { request } = schema.parse(args);
    
    const availableTools = [
      "search_content",
      "get_content_details", 
      "synthesize_content",
      "find_similar_content",
      "list_saved_content"
    ];
    
    const plan = planQueryStrategy(request, availableTools);
    
    let responseText = `# Query Plan for: "${request}"\n\n`;
    responseText += `## Strategy: ${plan.strategy}\n`;
    responseText += `## Estimated Tokens: ~${plan.estimatedTokens.toLocaleString()}\n\n`;
    responseText += `## Execution Steps:\n\n`;
    
    plan.steps.forEach((step, idx) => {
      responseText += `### Step ${idx + 1}: ${step.tool}\n`;
      responseText += `**Purpose:** ${step.purpose}\n`;
      responseText += `**Parameters:**\n`;
      for (const [key, value] of Object.entries(step.params)) {
        responseText += `- ${key}: ${JSON.stringify(value)}\n`;
      }
      
      const tokenEstimate = estimateTokenUsage({ tool: step.tool, params: step.params });
      responseText += `**Estimated Tokens:** ~${tokenEstimate.estimated.toLocaleString()}`;
      if (tokenEstimate.warning) {
        responseText += ` ⚠️ ${tokenEstimate.warning}`;
      }
      responseText += `\n`;
      if (tokenEstimate.suggestion) {
        responseText += `**Suggestion:** ${tokenEstimate.suggestion}\n`;
      }
      responseText += `\n`;
    });
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: plan,
    };
  },
};