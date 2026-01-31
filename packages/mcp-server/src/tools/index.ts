import { Tool } from "./types.js";

// CORE TOOLS - Focused minimal set
// Based on user feedback: "Noverload handles storage and retrieval. LLM handles thinking."
import { listSavedContentTool } from "./implementations/list-content.js";
import { getContentDetailsTool } from "./implementations/get-content.js";
import { searchContentTool } from "./implementations/search.js";
import { saveContentTool } from "./implementations/save-content.js";
import { batchGetContentTool } from "./implementations/batch-get.js";
import { exploreTopicTool } from "./implementations/explore-topic.js";
import { extractFrameworksTool } from "./implementations/extract-frameworks.js";
import { listGoalsTool } from "./implementations/goals.js";

// TAG TOOLS - Discovery only, management done in platform
import { listTagsTool } from "./implementations/list-tags.js";

// ARCHIVED TOOLS (in _archived/ folder for potential future use):
// - synthesize.ts: explore_topic does this better
// - extract-insights.ts: LLMs can extract insights from raw content
// - knowledge-graph.ts: Limited results, LLMs can map relationships
// - smart-sections.ts: Content extraction issues
// - raw-content.ts: Redundant with get-content.ts
// - find-connections.ts: LLMs can find connections
// - expand-search.ts: LLMs can reformulate queries
// - plan-query.ts: LLMs can plan queries
// - estimate-tokens.ts: Nice-to-have but not essential
// - instructions.ts: Guidance now in MCP system prompt
// - similar-content.ts: search_content covers most cases
// - timeline.ts: Niche use case
// - manage-tags.ts: Tag management done in platform (create_tag, add_tags, remove_tags)
// - swipe-file.ts: Swipe file management done in platform (mark_as_swipe_file, unmark_swipe_file)
// - actions.ts: Actions feature removed from app (list_actions, complete_action)

// Export all tools as a single array
export const tools: Tool[] = [
  // 1. Discovery: "What do I have?"
  listSavedContentTool,

  // 2. Search: "Find relevant content" (RAG-powered)
  searchContentTool,

  // 3. Retrieval: "Give me this article" (includes full content)
  getContentDetailsTool,

  // 4. Batch Retrieval: "Give me these articles"
  batchGetContentTool,

  // 5. Synthesis: "Explore topic X" (context-efficient pre-processed insights)
  exploreTopicTool,

  // 6. Frameworks: "Extract methodologies and frameworks"
  extractFrameworksTool,

  // 7. Save: "Save this URL" (now with optional tags)
  saveContentTool,

  // 8. Goals
  listGoalsTool,

  // 9. Tag discovery (management done in platform)
  listTagsTool,
];

// Export individual tools for testing
export {
  listSavedContentTool,
  getContentDetailsTool,
  searchContentTool,
  saveContentTool,
  batchGetContentTool,
  exploreTopicTool,
  extractFrameworksTool,
  listGoalsTool,
  listTagsTool,
};