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
import { expandSearchTool } from "./implementations/expand-search.js";
import { smartSectionsTool } from "./implementations/smart-sections.js";

// ARCHIVED - IN DEVELOPMENT
// These tools need more work before being production-ready
// import { findExamplesTool } from "./implementations/find-examples.js";
// import { buildNarrativeTool } from "./implementations/build-narrative.js";

// Export all tools as a single array
export const tools: Tool[] = [
  // CORE TOOLS - Optimized for LLM context provision
  
  // Content retrieval and listing
  listSavedContentTool,
  getContentDetailsTool,  // Now returns FULL content for context
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
  extractFrameworksTool,  // Fixed to use synthesis API
  
  // ARCHIVED - IN DEVELOPMENT
  // findExamplesTool,     // Needs database schema updates
  // buildNarrativeTool,   // Needs refinement
  
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
  // Core content tools
  listSavedContentTool,
  getContentDetailsTool,
  searchContentTool,
  saveContentTool,
  
  // Actions and goals
  listActionsTool,
  completeActionTool,
  listGoalsTool,
  
  // Analysis tools
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
  expandSearchTool,
  smartSectionsTool,
  
  // ARCHIVED - Available for testing but not in production
  // findExamplesTool,
  // buildNarrativeTool,
};