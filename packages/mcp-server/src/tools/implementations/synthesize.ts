import { z } from "zod";
import { Tool } from "../types.js";

export const synthesizeContentTool: Tool = {
  name: "synthesize_content",
  description: "Analyze multiple content sources to generate actionable insights, find patterns, connections, and contradictions. Creates structured synthesis with timeline, next steps, and confidence scores.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Topic or question to synthesize insights about",
      },
      contentIds: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Specific content IDs to analyze (optional, otherwise uses search)",
      },
      synthesisMode: {
        type: "string",
        enum: ["overview", "deep", "actionable", "comparison"],
        description: "Type of synthesis to perform (default: actionable)",
        default: "actionable",
      },
      findContradictions: {
        type: "boolean",
        description: "Look for contradictions between sources",
        default: false,
      },
      findConnections: {
        type: "boolean",
        description: "Find connections and patterns across sources",
        default: true,
      },
      maxSources: {
        type: "number",
        description: "Maximum number of sources to analyze",
        default: 10,
      },
    },
    required: ["query"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      query: z.string(),
      contentIds: z.array(z.string()).optional(),
      synthesisMode: z.enum(["overview", "deep", "actionable", "comparison"]).optional().default("actionable"),
      findContradictions: z.boolean().optional().default(false),
      findConnections: z.boolean().optional().default(true),
      maxSources: z.number().optional().default(10),
    });
    const params = schema.parse(args);
    const result = await client.synthesizeContent(params);
    
    // Handle the API v2 response format
    const synthesis = result.synthesis || result;
    const metadata = result.metadata || {};
    const sources = result.sources || [];
    
    let responseText = `# 🎯 Synthesis: "${params.query}"\n`;
    responseText += `**Mode:** ${synthesis.mode || params.synthesisMode} | **Sources:** ${metadata.sourceCount || sources.length}`;
    
    // Add confidence indicator if available
    if (metadata.confidence) {
      const confidenceIcon = metadata.confidence >= 80 ? "🟢" : metadata.confidence >= 60 ? "🟡" : "🔴";
      responseText += ` | **Confidence:** ${confidenceIcon} ${metadata.confidence}%`;
    }
    responseText += `\n\n`;
    
    // Summary Section
    if (synthesis.summary) {
      responseText += `## 📋 Summary\n${synthesis.summary}\n\n`;
    }
    
    // Insights Section (most important)
    if (synthesis.insights && synthesis.insights.length > 0) {
      responseText += `## 💡 Key Insights\n`;
      synthesis.insights.forEach((insight: any, idx: number) => {
        // Handle both string and object insights
        if (typeof insight === 'string') {
          responseText += `${idx + 1}. ${insight}\n`;
        } else if (insight.text) {
          responseText += `${idx + 1}. **${insight.text}**`;
          if (insight.sourceTitle) {
            responseText += ` *(from: ${insight.sourceTitle})*`;
          }
          responseText += `\n`;
        }
      });
      responseText += `\n`;
    }
    
    // Action Plan (for actionable mode)
    if (synthesis.actionPlan) {
      responseText += `## 🚀 Action Plan\n`;
      
      if (synthesis.actionPlan.summary) {
        responseText += `${synthesis.actionPlan.summary}\n\n`;
      }
      
      if (synthesis.actionPlan.nextAction) {
        responseText += `**🎯 Next Action:** ${synthesis.actionPlan.nextAction.action || synthesis.actionPlan.nextAction}\n\n`;
      }
      
      if (synthesis.actionPlan.steps && synthesis.actionPlan.steps.length > 0) {
        responseText += `### Steps\n`;
        synthesis.actionPlan.steps.forEach((step: any, idx: number) => {
          const priorityIcon = step.priority === "high" ? "🔴" : step.priority === "medium" ? "🟡" : "🟢";
          responseText += `${idx + 1}. ${priorityIcon} **${step.action}**`;
          if (step.timeframe) {
            responseText += ` *(${step.timeframe})*`;
          }
          if (step.reasoning) {
            responseText += `\n   - Reasoning: ${step.reasoning}`;
          }
          responseText += `\n`;
        });
      }
      responseText += `\n`;
    }
    
    // Source Information
    if (sources && sources.length > 0) {
      responseText += `## 📚 Sources Analyzed\n`;
      sources.forEach((source: any, idx: number) => {
        const typeIcons: Record<string, string> = {
          youtube: "📺",
          x_twitter: "𝕏",
          reddit: "🔗",
          article: "📄",
          pdf: "📑"
        };
        const typeIcon = typeIcons[source.type] || "📄";
        
        responseText += `${idx + 1}. ${typeIcon} [${source.title}](${source.url})\n`;
      });
      responseText += `\n`;
    }
    
    // Metadata Footer
    responseText += `---\n`;
    responseText += `*Analysis completed in ${metadata.executionTime ? `${metadata.executionTime}ms` : 'N/A'}`;
    if (metadata.totalTokens) {
      responseText += ` | Processed ${metadata.totalTokens.toLocaleString()} tokens`;
    }
    responseText += `*\n`;
    
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