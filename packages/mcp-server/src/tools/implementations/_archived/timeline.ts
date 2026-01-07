import { z } from "zod";
import { Tool } from "../types.js";

export const getTimelineTool: Tool = {
  name: "get_timeline",
  description: "Get chronological understanding of how a topic has evolved over time across your saved content",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The topic to track over time",
      },
      groupBy: {
        type: "string",
        enum: ["day", "week", "month", "year"],
        description: "How to group the timeline",
        default: "month",
      },
      includeInsights: {
        type: "boolean",
        description: "Include key insights for each time period",
        default: true,
      },
      maxItems: {
        type: "number",
        description: "Maximum number of timeline items",
        default: 20,
      },
    },
    required: ["topic"],
  },
  modifies: false,
  handler: async (client, args) => {
    const schema = z.object({
      topic: z.string(),
      groupBy: z.enum(["day", "week", "month", "year"]).optional().default("month"),
      includeInsights: z.boolean().optional().default(true),
      maxItems: z.number().optional().default(20),
    });
    const params = schema.parse(args);
    
    // Search for content related to the topic
    const searchResults = await client.searchContent(params.topic, {
      limit: 50, // Get more results for timeline
      enableConceptExpansion: false, // More precise for timeline
    });
    
    if (!searchResults || searchResults.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No content found for topic: "${params.topic}". Timeline cannot be generated without saved content.`,
          },
        ],
        data: null,
      };
    }
    
    // Sort by date and group
    const sorted = searchResults
      .filter((r: any) => r.createdAt)
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Group by time period
    const timeline = new Map<string, any[]>();
    
    sorted.forEach((item: any) => {
      const date = new Date(item.createdAt);
      let key: string;
      
      switch (params.groupBy) {
        case "day":
          key = date.toISOString().split('T')[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `Week of ${weekStart.toISOString().split('T')[0]}`;
          break;
        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case "year":
          key = String(date.getFullYear());
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      
      if (!timeline.has(key)) {
        timeline.set(key, []);
      }
      timeline.get(key)!.push(item);
    });
    
    let responseText = `# ⏱️ Timeline: "${params.topic}"\n`;
    responseText += `**Period:** Grouped by ${params.groupBy}\n`;
    responseText += `**Content Found:** ${sorted.length} items across ${timeline.size} time periods\n\n`;
    
    // Generate timeline
    let itemCount = 0;
    const timelineData: any[] = [];
    
    Array.from(timeline.entries())
      .slice(-params.maxItems) // Get most recent periods
      .forEach(([period, items]) => {
        if (itemCount >= params.maxItems) return;
        
        responseText += `## 📅 ${period}\n`;
        responseText += `*${items.length} item${items.length > 1 ? 's' : ''} saved*\n\n`;
        
        const periodData: any = {
          period,
          itemCount: items.length,
          items: [],
        };
        
        // Show key items from this period
        items.slice(0, 3).forEach((item: any) => {
          const typeIcons: Record<string, string> = {
            youtube: "📺",
            x_twitter: "𝕏",
            reddit: "🔗",
            article: "📄",
            pdf: "📑"
          };
          const icon = typeIcons[item.contentType] || "📄";
          
          responseText += `### ${icon} ${item.title || "Untitled"}\n`;
          
          if (params.includeInsights && item.summary) {
            const summary = typeof item.summary === 'string' 
              ? item.summary 
              : item.summary.one_sentence || item.summary.text;
            if (summary) {
              responseText += `💡 ${summary.slice(0, 200)}${summary.length > 200 ? '...' : ''}\n`;
            }
          }
          
          responseText += `🔗 [Link](${item.url})\n\n`;
          
          periodData.items.push({
            id: item.id,
            title: item.title,
            type: item.contentType,
            summary: item.summary,
            url: item.url,
          });
        });
        
        if (items.length > 3) {
          responseText += `*... and ${items.length - 3} more items from this period*\n\n`;
        }
        
        // Evolution insights
        if (params.includeInsights && items.length > 1) {
          const tags = new Set<string>();
          items.forEach((item: any) => {
            if (item.tags) {
              item.tags.forEach((tag: string) => tags.add(tag));
            }
          });
          
          if (tags.size > 0) {
            responseText += `**Key themes:** ${Array.from(tags).slice(0, 5).join(', ')}\n\n`;
            periodData.themes = Array.from(tags);
          }
        }
        
        responseText += `---\n\n`;
        timelineData.push(periodData);
        itemCount++;
      });
    
    // Add evolution summary
    if (timeline.size > 1) {
      responseText += `## 📈 Evolution Summary\n`;
      
      const firstPeriod = Array.from(timeline.keys())[0];
      const lastPeriod = Array.from(timeline.keys())[timeline.size - 1];
      
      responseText += `- **Timespan:** ${firstPeriod} to ${lastPeriod}\n`;
      responseText += `- **Total Periods:** ${timeline.size}\n`;
      responseText += `- **Average per ${params.groupBy}:** ${(sorted.length / timeline.size).toFixed(1)} items\n`;
      
      // Find peak period
      let peakPeriod = "";
      let peakCount = 0;
      timeline.forEach((items, period) => {
        if (items.length > peakCount) {
          peakCount = items.length;
          peakPeriod = period;
        }
      });
      
      responseText += `- **Most Active Period:** ${peakPeriod} (${peakCount} items)\n\n`;
      
      responseText += `💡 **Tip:** Use \`explore_topic\` for deeper analysis of specific time periods.\n`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
      data: {
        topic: params.topic,
        groupBy: params.groupBy,
        timeline: timelineData,
        totalItems: sorted.length,
        totalPeriods: timeline.size,
      },
    };
  },
};