import { Tool } from "./types.js";

// Import all tool implementations
import { listSavedContentTool } from "./implementations/list-content.js";
import { getContentDetailsTool } from "./implementations/get-content.js";
import { searchContentTool } from "./implementations/search.js";
import { saveContentTool } from "./implementations/save-content.js";
import { listActionsTool, completeActionTool } from "./implementations/actions.js";
import { listGoalsTool } from "./implementations/goals.js";
import { estimateSearchTokensTool } from "./implementations/estimate-tokens.js";
import { synthesizeContentTool } from "./implementations/synthesize.js";
import { findSimilarContentTool } from "./implementations/similar-content.js";
import { batchGetContentTool } from "./implementations/batch-get.js";
import { getInstructionsTool } from "./implementations/instructions.js";
import { planQueryTool } from "./implementations/plan-query.js";
import { getRawContentTool } from "./implementations/raw-content.js";
import { exploreTopicTool } from "./implementations/explore-topic.js";
import { findConnectionsTool } from "./implementations/find-connections.js";
import { extractInsightsTool } from "./implementations/extract-insights.js";
import { getTimelineTool } from "./implementations/timeline.js";
import { buildKnowledgeGraphTool } from "./implementations/knowledge-graph.js";
import { extractFrameworksTool } from "./implementations/extract-frameworks.js";
import { findExamplesTool } from "./implementations/find-examples.js";
import { buildNarrativeTool } from "./implementations/build-narrative.js";
import { expandSearchTool } from "./implementations/expand-search.js";
import { smartSectionsTool } from "./implementations/smart-sections.js";

// Export all tools as a single array
export const tools: Tool[] = [
  // Content retrieval and listing
  listSavedContentTool,
  getContentDetailsTool,
  getRawContentTool,
  batchGetContentTool,
  
  // Search and discovery
  searchContentTool,
  findSimilarContentTool,
  expandSearchTool,
  
  // Analysis and synthesis
  synthesizeContentTool,
  exploreTopicTool,
  findConnectionsTool,
  extractInsightsTool,
  getTimelineTool,
  buildKnowledgeGraphTool,
  extractFrameworksTool,
  findExamplesTool,
  buildNarrativeTool,
  
  // Actions and goals
  listActionsTool,
  completeActionTool,
  listGoalsTool,
  
  // Content management
  saveContentTool,
  smartSectionsTool,
  
  // Utility and planning
  estimateSearchTokensTool,
  getInstructionsTool,
  planQueryTool,
];

// Export individual tools for testing or specific usage
export {
  listSavedContentTool,
  getContentDetailsTool,
  searchContentTool,
  saveContentTool,
  listActionsTool,
  completeActionTool,
  listGoalsTool,
  estimateSearchTokensTool,
  synthesizeContentTool,
  findSimilarContentTool,
  batchGetContentTool,
  getInstructionsTool,
  planQueryTool,
  getRawContentTool,
  exploreTopicTool,
  findConnectionsTool,
  extractInsightsTool,
  getTimelineTool,
  buildKnowledgeGraphTool,
  extractFrameworksTool,
  findExamplesTool,
  buildNarrativeTool,
  expandSearchTool,
  smartSectionsTool,
};