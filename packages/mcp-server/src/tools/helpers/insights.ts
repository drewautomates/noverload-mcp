// Helper functions for extracting insights

export function extractTypedInsights(results: any[], query: string, type: string, minConfidence: number): any[] {
  // Simplified insight extraction
  const insights: any[] = [];
  
  switch (type) {
    case "patterns":
      // Find recurring themes
      const themes = new Map<string, any[]>();
      results.forEach(result => {
        if (result.tags) {
          result.tags.forEach((tag: string) => {
            if (!themes.has(tag)) themes.set(tag, []);
            themes.get(tag)!.push(result);
          });
        }
      });
      
      Array.from(themes.entries())
        .filter(([_, sources]) => sources.length >= 2)
        .forEach(([theme, sources]) => {
          insights.push({
            pattern: theme,
            frequency: sources.length,
            confidence: sources.length / results.length,
            examples: sources.slice(0, 3).map(s => ({
              text: s.title || "Untitled",
              source: s.contentType,
            })),
          });
        });
      break;
      
    case "actionable":
      // Extract actionable items from summaries
      results.forEach(result => {
        if (result.summary && typeof result.summary === 'object' && result.summary.actionable_takeaways) {
          result.summary.actionable_takeaways.forEach((action: string) => {
            insights.push({
              action,
              reasoning: "Extracted from content analysis",
              priority: "medium",
              sources: [result],
              confidence: 0.8,
            });
          });
        }
      });
      break;
      
    default:
      // Generic insight extraction
      results.slice(0, 5).forEach(result => {
        if (result.summary) {
          insights.push({
            text: typeof result.summary === 'string' ? result.summary : result.summary.one_sentence,
            source: result.title || "Untitled",
            confidence: 0.75,
          });
        }
      });
  }
  
  return insights.filter((i: any) => i.confidence >= minConfidence);
}