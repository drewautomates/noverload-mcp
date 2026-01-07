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
    const sources = metadata.sources || result.sources || [];

    let responseText = `# 🎯 Synthesis: "${params.query}"\n`;
    responseText += `**Mode:** ${synthesis.mode || params.synthesisMode} | **Sources:** ${metadata.sourceCount || sources.length}`;

    // Add confidence indicator - check multiple possible locations
    const confidenceValue = metadata.confidence ||
      (synthesis.confidence?.overall ? Math.round(synthesis.confidence.overall * 100) : null);
    if (confidenceValue) {
      const confidenceIcon = confidenceValue >= 80 ? "🟢" : confidenceValue >= 60 ? "🟡" : "🔴";
      responseText += ` | **Confidence:** ${confidenceIcon} ${confidenceValue}%`;
    }
    responseText += `\n\n`;

    // Summary Section - check multiple possible field names
    const summaryText = synthesis.summary || synthesis.executiveSummary;
    if (summaryText) {
      responseText += `## 📋 Summary\n${summaryText}\n\n`;
    }

    // Insights Section - check multiple possible formats
    const insights = synthesis.insights || synthesis.actionableInsights || [];
    if (insights.length > 0) {
      responseText += `## 💡 Key Insights\n`;
      insights.forEach((insight: any, idx: number) => {
        // Handle various insight formats
        if (typeof insight === 'string') {
          responseText += `${idx + 1}. ${insight}\n`;
        } else if (insight.insight) {
          // Format from actionableInsights
          const priorityIcon = insight.priority === "high" ? "🔴" : insight.priority === "medium" ? "🟡" : "🟢";
          responseText += `${idx + 1}. ${priorityIcon} **${insight.insight}**`;
          if (insight.category) {
            responseText += ` *(${insight.category})*`;
          }
          responseText += `\n`;
          if (insight.supportingEvidence && insight.supportingEvidence.length > 0) {
            responseText += `   - Evidence: ${insight.supportingEvidence[0]}\n`;
          }
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

    // Key Themes (from enhanced synthesis)
    if (synthesis.keyThemes && synthesis.keyThemes.length > 0) {
      responseText += `## 🎨 Key Themes\n`;
      synthesis.keyThemes.forEach((theme: any, idx: number) => {
        responseText += `${idx + 1}. **${theme.theme}** (${theme.frequency} sources)\n`;
        if (theme.insight) {
          responseText += `   - ${theme.insight}\n`;
        }
      });
      responseText += `\n`;
    }

    // Action Plan - check multiple formats
    const actionPlan = synthesis.actionPlan;
    const nextSteps = synthesis.recommendedNextSteps || [];
    if (actionPlan || nextSteps.length > 0) {
      responseText += `## 🚀 Action Plan\n`;

      if (actionPlan?.summary) {
        responseText += `${actionPlan.summary}\n\n`;
      }

      if (actionPlan?.nextAction) {
        responseText += `**🎯 Next Action:** ${actionPlan.nextAction.action || actionPlan.nextAction}\n\n`;
      }

      if (actionPlan?.steps && actionPlan.steps.length > 0) {
        responseText += `### Steps\n`;
        actionPlan.steps.forEach((step: any, idx: number) => {
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

      // recommendedNextSteps from enhanced synthesis
      if (nextSteps.length > 0) {
        responseText += `${nextSteps.length} actionable steps identified\n`;
        nextSteps.forEach((step: string, idx: number) => {
          responseText += `${idx + 1}. ${step}\n`;
        });
      }
      responseText += `\n`;
    }

    // Knowledge Gaps (from enhanced synthesis)
    if (synthesis.knowledgeGaps && synthesis.knowledgeGaps.length > 0) {
      responseText += `## ❓ Knowledge Gaps\n`;
      responseText += `Consider researching:\n`;
      synthesis.knowledgeGaps.forEach((gap: string) => {
        responseText += `- ${gap}\n`;
      });
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