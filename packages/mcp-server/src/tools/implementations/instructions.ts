import { z } from "zod";
import { Tool } from "../types.js";
import { generateLLMInstructions } from "../../llm-instructions.js";

export const getInstructionsTool: Tool = {
  name: "get_instructions",
  description: "Get instructions for optimal MCP usage, including capabilities, best practices, and example workflows",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Specific topic for instructions (optional)",
        enum: ["search", "synthesis", "retrieval", "general"],
      },
      includeExamples: {
        type: "boolean",
        description: "Include workflow examples",
        default: true,
      },
    },
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      topic: z.enum(["search", "synthesis", "retrieval", "general"]).optional(),
      includeExamples: z.boolean().optional().default(true),
    });
    const params = schema.parse(args);
    
    const instructions = generateLLMInstructions();
    
    let responseText = `# Noverload MCP Usage Instructions\n\n`;
    responseText += `## Version: ${instructions.version}\n\n`;
    
    if (!params.topic || params.topic === "general") {
      // Show all capabilities
      responseText += `## Capabilities Overview\n\n`;
      
      for (const [key, capability] of Object.entries(instructions.capabilities)) {
        responseText += `### ${key.charAt(0).toUpperCase() + key.slice(1)}\n`;
        responseText += `${capability.description}\n\n`;
        responseText += `**Strengths:**\n`;
        capability.strengths.forEach((s: string) => responseText += `- ${s}\n`);
        responseText += `\n**When to use:**\n`;
        capability.whenToUse.forEach((w: string) => responseText += `- ${w}\n`);
        responseText += `\n`;
      }
      
      responseText += `## Best Practices\n\n`;
      for (const [scenario, practice] of Object.entries(instructions.bestPractices)) {
        responseText += `**${scenario.replace(/([A-Z])/g, ' $1').toLowerCase()}:** ${practice}\n`;
      }
      responseText += `\n`;
    } else {
      // Show specific capability
      const capability = instructions.capabilities[params.topic];
      if (capability) {
        responseText += `## ${params.topic.charAt(0).toUpperCase() + params.topic.slice(1)} Capability\n\n`;
        responseText += `${capability.description}\n\n`;
        responseText += `### Strengths\n`;
        capability.strengths.forEach(s => responseText += `- ${s}\n`);
        responseText += `\n### Limitations\n`;
        capability.limitations.forEach(l => responseText += `- ${l}\n`);
        responseText += `\n### When to Use\n`;
        capability.whenToUse.forEach(w => responseText += `- ${w}\n`);
      }
    }
    
    if (params.includeExamples && instructions.exampleWorkflows.length > 0) {
      responseText += `\n## Example Workflows\n\n`;
      instructions.exampleWorkflows.forEach((example, idx) => {
        responseText += `### ${idx + 1}. ${example.scenario}\n`;
        responseText += `**Steps:**\n`;
        example.steps.forEach((step, i) => responseText += `${i + 1}. ${step}\n`);
        responseText += `**Expected Outcome:** ${example.expectedOutcome}\n\n`;
      });
    }
    
    responseText += `## Token Management\n\n`;
    responseText += `- Search results limit: ${instructions.tokenManagement.searchResultsLimit}\n`;
    responseText += `- Use chunking: ${instructions.tokenManagement.useChunking ? 'Yes' : 'No'}\n`;
    responseText += `- Get summaries first: ${instructions.tokenManagement.summaryFirst ? 'Yes' : 'No'}\n`;
    responseText += `- Max content per query: ${instructions.tokenManagement.maxContentPerQuery.toLocaleString()} tokens\n`;
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: instructions,
    };
  },
};