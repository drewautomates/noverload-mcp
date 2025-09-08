import { z } from "zod";
import { NoverloadClient } from "../../client.js";
import { Tool } from "../types.js";

const inputSchema = z.object({
  story: z.string().describe("The story or narrative you want to build"),
  goal: z
    .string()
    .describe(
      "The goal or purpose of this narrative (e.g., 'pitch deck', 'origin story', 'case study')"
    ),
  maxSources: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of sources to use"),
  includeFrameworks: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include relevant frameworks"),
  includeExamples: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include supporting examples"),
});

interface NarrativeSection {
  title: string;
  content: string;
  supportingSources: {
    id: string;
    title: string;
    url: string;
    relevantInsight: string;
  }[];
  frameworks?: {
    name: string;
    application: string;
  }[];
  examples?: {
    description: string;
    relevance: string;
  }[];
}

interface StructuredNarrative {
  title: string;
  purpose: string;
  summary: string;
  sections: NarrativeSection[];
  keyTakeaways: string[];
  callToAction?: string;
}

export const buildNarrativeTool: Tool = {
  name: "noverload_build_narrative",
  description:
    "Build a structured narrative using your saved content. Automatically finds supporting content, frameworks, and examples to craft compelling stories for pitches, presentations, or case studies.",
  inputSchema: {
    type: "object",
    properties: {
      story: {
        type: "string",
        description: "The story or narrative you want to build",
      },
      goal: {
        type: "string",
        description:
          "The goal or purpose of this narrative (e.g., 'pitch deck', 'origin story', 'case study')",
      },
      maxSources: {
        type: "number",
        default: 10,
        description: "Maximum number of sources to use",
      },
      includeFrameworks: {
        type: "boolean",
        default: true,
        description: "Include relevant frameworks",
      },
      includeExamples: {
        type: "boolean",
        default: true,
        description: "Include supporting examples",
      },
    },
    required: ["story", "goal"],
  },
  modifies: false,

  handler: async (client: NoverloadClient, args: unknown) => {
    const input = inputSchema.parse(args);

    try {
      // Step 1: Search for relevant content
      const searchQuery = `${input.story} ${input.goal}`;
      const searchResults = await client.searchContentV2({
        query: searchQuery,
        mode: "all",
        limit: input.maxSources * 2, // Get extra to filter
      });

      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `🔍 No relevant content found for building your narrative about "${input.story}". Try saving more content related to this topic first.`,
            },
          ],
          data: {
            narrative: null,
            searchQuery: searchQuery,
          },
        };
      }

      // Step 2: Find frameworks if requested
      let relevantFrameworks: any[] = [];
      if (input.includeFrameworks) {
        // Look for frameworks in the content
        for (const content of searchResults.results.slice(
          0,
          input.maxSources
        )) {
          if (content.aiInsights?.frameworks) {
            relevantFrameworks.push(...content.aiInsights.frameworks);
          }
        }
      }

      // Step 3: Find examples if requested
      let relevantExamples: any[] = [];
      if (input.includeExamples) {
        // Look for examples in the content
        for (const content of searchResults.results.slice(
          0,
          input.maxSources
        )) {
          if (content.aiInsights?.extracted_examples) {
            relevantExamples.push(...content.aiInsights.extracted_examples);
          }
        }
      }

      // Step 4: Build the narrative structure
      const narrative: StructuredNarrative = {
        title: input.story,
        purpose: input.goal,
        summary: `A ${input.goal} about ${input.story}, supported by insights from ${Math.min(searchResults.results.length, input.maxSources)} sources.`,
        sections: [],
        keyTakeaways: [],
      };

      // Determine sections based on goal type
      const sectionTemplates = getSectionTemplates(input.goal);

      // Build each section
      for (const template of sectionTemplates) {
        const section: NarrativeSection = {
          title: template.title,
          content: "",
          supportingSources: [],
          frameworks: [],
          examples: [],
        };

        // Find relevant content for this section
        const relevantContent = searchResults.results
          .filter((content: any) => {
            // Match content to section based on keywords
            const contentText =
              (content.summary?.toString() || "") +
              (content.keyInsights?.join(" ") || "");
            return template.keywords.some((keyword: string) =>
              contentText.toLowerCase().includes(keyword.toLowerCase())
            );
          })
          .slice(0, 3); // Max 3 sources per section

        // Build section content
        if (relevantContent.length > 0) {
          section.content = template.prompt;

          // Add supporting sources
          for (const content of relevantContent) {
            const insight =
              content.keyInsights?.[0] ||
              (typeof content.summary === "string"
                ? content.summary.substring(0, 100)
                : "");

            section.supportingSources.push({
              id: content.id,
              title: content.title || "Untitled",
              url: content.url,
              relevantInsight: insight,
            });
          }

          // Add relevant frameworks
          if (input.includeFrameworks && relevantFrameworks.length > 0) {
            const applicableFrameworks = relevantFrameworks
              .filter((fw: any) =>
                fw.useCases?.some((uc: string) =>
                  template.keywords.some((kw: string) =>
                    uc.toLowerCase().includes(kw.toLowerCase())
                  )
                )
              )
              .slice(0, 2);

            section.frameworks = applicableFrameworks.map((fw) => ({
              name: fw.name,
              application: `Apply ${fw.name} to ${template.application}`,
            }));
          }

          // Add relevant examples
          if (input.includeExamples && relevantExamples.length > 0) {
            const applicableExamples = relevantExamples
              .filter((ex) => template.exampleTypes.includes(ex.type))
              .slice(0, 2);

            section.examples = applicableExamples.map((ex) => ({
              description: ex.description,
              relevance: `Shows ${template.exampleRelevance}`,
            }));
          }

          narrative.sections.push(section);
        }
      }

      // Generate key takeaways
      narrative.keyTakeaways = generateKeyTakeaways(narrative.sections);

      // Add call to action based on goal
      narrative.callToAction = getCallToAction(input.goal);

      // Format response
      let responseText = `📖 **${narrative.title}**\n`;
      responseText += `*Purpose: ${narrative.purpose}*\n\n`;
      responseText += `${narrative.summary}\n\n`;

      // Output each section
      for (const section of narrative.sections) {
        responseText += `## ${section.title}\n\n`;
        responseText += `${section.content}\n\n`;

        if (section.supportingSources.length > 0) {
          responseText += `**Supporting Evidence:**\n`;
          for (const source of section.supportingSources) {
            const icon = source.url.includes("youtube")
              ? "📺"
              : source.url.includes("twitter")
                ? "𝕏"
                : source.url.includes("reddit")
                  ? "🟠"
                  : "📖";
            responseText += `- ${icon} [${source.title}](${source.url}): "${source.relevantInsight}"\n`;
          }
          responseText += `\n`;
        }

        if (section.frameworks && section.frameworks.length > 0) {
          responseText += `**Applicable Frameworks:**\n`;
          for (const fw of section.frameworks) {
            responseText += `- 🎯 **${fw.name}**: ${fw.application}\n`;
          }
          responseText += `\n`;
        }

        if (section.examples && section.examples.length > 0) {
          responseText += `**Examples:**\n`;
          for (const ex of section.examples) {
            responseText += `- 📊 ${ex.description} (${ex.relevance})\n`;
          }
          responseText += `\n`;
        }
      }

      // Add key takeaways
      if (narrative.keyTakeaways.length > 0) {
        responseText += `## 🎯 Key Takeaways\n\n`;
        for (const takeaway of narrative.keyTakeaways) {
          responseText += `- ${takeaway}\n`;
        }
        responseText += `\n`;
      }

      // Add call to action
      if (narrative.callToAction) {
        responseText += `## 🚀 ${narrative.callToAction}\n\n`;
      }

      // Add metadata
      responseText += `---\n`;
      responseText += `*Built from ${narrative.sections.reduce((acc, s) => acc + s.supportingSources.length, 0)} sources`;
      if (relevantFrameworks.length > 0) {
        responseText += `, ${relevantFrameworks.length} frameworks`;
      }
      if (relevantExamples.length > 0) {
        responseText += `, ${relevantExamples.length} examples`;
      }
      responseText += `*\n`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        data: {
          narrative: narrative,
          totalSources: searchResults.results.length,
          frameworksFound: relevantFrameworks.length,
          examplesFound: relevantExamples.length,
          searchQuery: searchQuery,
        },
      };
    } catch (error) {
      console.error("Build narrative error:", error);

      return {
        content: [
          {
            type: "text",
            text: `❌ Error building narrative: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        error: true,
      };
    }
  },
};

// Helper function to get section templates based on goal
function getSectionTemplates(goal: string): any[] {
  const goalLower = goal.toLowerCase();

  if (goalLower.includes("pitch") || goalLower.includes("investor")) {
    return [
      {
        title: "The Problem",
        prompt: "Define the problem your audience faces",
        keywords: ["problem", "challenge", "pain", "issue", "struggle"],
        application: "frame the problem",
        exampleTypes: ["failure", "case_study"],
        exampleRelevance: "the problem is real",
      },
      {
        title: "The Solution",
        prompt: "Present your unique solution",
        keywords: ["solution", "solve", "answer", "approach", "method"],
        application: "present the solution",
        exampleTypes: ["success_story", "transformation"],
        exampleRelevance: "the solution works",
      },
      {
        title: "Market Opportunity",
        prompt: "Demonstrate the size and potential",
        keywords: ["market", "opportunity", "growth", "potential", "size"],
        application: "size the opportunity",
        exampleTypes: ["case_study", "success_story"],
        exampleRelevance: "market validation",
      },
      {
        title: "The Ask",
        prompt: "Make your specific request",
        keywords: ["investment", "funding", "support", "partnership"],
        application: "structure the ask",
        exampleTypes: ["success_story"],
        exampleRelevance: "successful outcomes",
      },
    ];
  } else if (goalLower.includes("origin") || goalLower.includes("story")) {
    return [
      {
        title: "The Beginning",
        prompt: "Where the journey started",
        keywords: ["start", "begin", "origin", "founded", "created"],
        application: "set the scene",
        exampleTypes: ["transformation"],
        exampleRelevance: "humble beginnings",
      },
      {
        title: "The Challenge",
        prompt: "The obstacles faced",
        keywords: ["challenge", "obstacle", "difficulty", "struggle"],
        application: "create tension",
        exampleTypes: ["failure", "case_study"],
        exampleRelevance: "overcoming adversity",
      },
      {
        title: "The Transformation",
        prompt: "The pivotal moment or realization",
        keywords: ["transform", "change", "pivot", "realize", "discover"],
        application: "show growth",
        exampleTypes: ["transformation", "success_story"],
        exampleRelevance: "breakthrough moments",
      },
      {
        title: "The Impact",
        prompt: "The results and future vision",
        keywords: ["impact", "result", "outcome", "success", "future"],
        application: "demonstrate value",
        exampleTypes: ["success_story", "case_study"],
        exampleRelevance: "meaningful impact",
      },
    ];
  } else {
    // Generic narrative structure
    return [
      {
        title: "Context",
        prompt: "Set the context and background",
        keywords: ["background", "context", "situation", "overview"],
        application: "establish context",
        exampleTypes: ["case_study"],
        exampleRelevance: "similar situations",
      },
      {
        title: "Key Points",
        prompt: "Present the main arguments or insights",
        keywords: ["key", "main", "important", "critical", "essential"],
        application: "structure arguments",
        exampleTypes: ["case_study", "success_story"],
        exampleRelevance: "supporting evidence",
      },
      {
        title: "Evidence",
        prompt: "Provide supporting evidence",
        keywords: ["evidence", "proof", "data", "results", "metrics"],
        application: "validate points",
        exampleTypes: ["case_study", "success_story"],
        exampleRelevance: "concrete proof",
      },
      {
        title: "Conclusion",
        prompt: "Summarize and call to action",
        keywords: ["conclusion", "summary", "therefore", "action"],
        application: "drive action",
        exampleTypes: ["transformation", "success_story"],
        exampleRelevance: "desired outcomes",
      },
    ];
  }
}

// Helper function to generate key takeaways
function generateKeyTakeaways(sections: NarrativeSection[]): string[] {
  const takeaways: string[] = [];

  for (const section of sections) {
    if (section.supportingSources.length > 0) {
      // Generate a takeaway from the section
      const sectionTakeaway = `${section.title}: ${section.supportingSources[0].relevantInsight.substring(0, 100)}`;
      takeaways.push(sectionTakeaway);
    }
  }

  return takeaways.slice(0, 5); // Max 5 takeaways
}

// Helper function to get call to action
function getCallToAction(goal: string): string {
  const goalLower = goal.toLowerCase();

  if (goalLower.includes("pitch") || goalLower.includes("investor")) {
    return "Next Steps: Schedule a meeting to discuss how we can work together";
  } else if (goalLower.includes("origin") || goalLower.includes("story")) {
    return "Join Us: Be part of the next chapter in our story";
  } else if (goalLower.includes("case study")) {
    return "Learn More: Discover how you can achieve similar results";
  } else {
    return "Take Action: Apply these insights to your own journey";
  }
}
