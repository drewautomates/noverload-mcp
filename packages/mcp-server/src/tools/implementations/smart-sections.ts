import { z } from "zod";
import { NoverloadClient } from "../../client.js";
import { Tool } from "../types.js";

const inputSchema = z.object({
  contentId: z.string().describe("ID of the content to section"),
  query: z
    .string()
    .optional()
    .describe("Optional: Extract specific section matching this query"),
  maxSections: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of sections to return"),
  sectionType: z
    .enum([
      "all",
      "introduction",
      "methods",
      "results",
      "examples",
      "conclusion",
      "code",
      "steps",
    ])
    .optional()
    .default("all")
    .describe("Type of sections to extract"),
});

interface ContentSection {
  id: string;
  type: string;
  title: string;
  content: string;
  startPosition: number;
  endPosition: number;
  tokenCount: number;
  relevance?: number;
  metadata?: {
    hasCode?: boolean;
    hasSteps?: boolean;
    hasExamples?: boolean;
    keyTopics?: string[];
  };
}

// Pattern definitions for different section types
const SECTION_PATTERNS = {
  introduction: {
    patterns: [
      /^#+\s*(introduction|intro|overview|background|abstract)/im,
      /^(In this (article|post|guide|tutorial|video|document))/im,
      /^(This (article|post|guide|tutorial) (covers|explains|discusses))/im,
    ],
    keywords: [
      "introduction",
      "overview",
      "background",
      "summary",
      "abstract",
      "preface",
    ],
  },
  methods: {
    patterns: [
      /^#+\s*(method|methodology|approach|implementation|how to|steps)/im,
      /^(Step \d+[:.])/im,
      /^(\d+\.\s+)/m,
    ],
    keywords: [
      "method",
      "approach",
      "process",
      "procedure",
      "technique",
      "algorithm",
    ],
  },
  results: {
    patterns: [
      /^#+\s*(results?|findings?|outcomes?|performance|metrics)/im,
      /(achieved|reached|resulted in|showed|demonstrated)/i,
    ],
    keywords: [
      "results",
      "findings",
      "outcomes",
      "performance",
      "metrics",
      "data",
    ],
  },
  examples: {
    patterns: [
      /^#+\s*(examples?|case stud|use cases?|scenarios?|demonstrations?)/im,
      /(for example|for instance|such as|consider|let's say)/i,
    ],
    keywords: [
      "example",
      "case",
      "instance",
      "scenario",
      "demonstration",
      "illustration",
    ],
  },
  conclusion: {
    patterns: [
      /^#+\s*(conclusion|summary|final thoughts|takeaways?|wrap.?up)/im,
      /^(In conclusion|To conclude|In summary|To sum up)/im,
    ],
    keywords: [
      "conclusion",
      "summary",
      "takeaway",
      "final",
      "closing",
      "recap",
    ],
  },
  code: {
    patterns: [/```[\s\S]*?```/g, /^```(\w+)?\n([\s\S]*?)^```/gm],
    keywords: [
      "code",
      "snippet",
      "implementation",
      "function",
      "class",
      "script",
    ],
  },
  steps: {
    patterns: [
      /^(Step \d+[:.])/im,
      /^(\d+\.\s+)/m,
      /^(First|Second|Third|Next|Then|Finally|Lastly)/im,
    ],
    keywords: [
      "step",
      "phase",
      "stage",
      "instruction",
      "direction",
      "procedure",
    ],
  },
};

function detectSections(
  content: string,
  sectionType: string
): ContentSection[] {
  const sections: ContentSection[] = [];
  const lines = content.split("\n");

  // Try to detect natural boundaries
  let currentSection: Partial<ContentSection> | null = null;
  let sectionId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const linePosition = lines.slice(0, i).join("\n").length;

    // Check for headers (markdown style)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      // Save previous section if exists
      if (currentSection && currentSection.content) {
        sections.push(currentSection as ContentSection);
      }

      // Start new section
      currentSection = {
        id: `section-${++sectionId}`,
        type: detectSectionType(headerMatch[2]),
        title: headerMatch[2],
        content: "",
        startPosition: linePosition,
        endPosition: linePosition,
        tokenCount: 0,
        metadata: {},
      };
      continue;
    }

    // Check for numbered lists as potential steps
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch && (sectionType === "all" || sectionType === "steps")) {
      if (!currentSection || currentSection.type !== "steps") {
        if (currentSection && currentSection.content) {
          sections.push(currentSection as ContentSection);
        }
        currentSection = {
          id: `section-${++sectionId}`,
          type: "steps",
          title: "Steps",
          content: "",
          startPosition: linePosition,
          endPosition: linePosition,
          tokenCount: 0,
          metadata: { hasSteps: true },
        };
      }
    }

    // Add content to current section
    if (currentSection) {
      currentSection.content += line + "\n";
      currentSection.endPosition = linePosition + line.length;
    } else if (sections.length === 0) {
      // Create initial section if no headers found yet
      currentSection = {
        id: `section-${++sectionId}`,
        type: "introduction",
        title: "Content",
        content: line + "\n",
        startPosition: 0,
        endPosition: line.length,
        tokenCount: 0,
        metadata: {},
      };
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.content) {
    sections.push(currentSection as ContentSection);
  }

  // Calculate token counts and detect metadata
  for (const section of sections) {
    section.tokenCount = Math.ceil(section.content.length / 4); // Rough estimate

    // Detect metadata
    section.metadata = {
      hasCode: /```[\s\S]*?```/.test(section.content),
      hasSteps: /^(\d+\.\s+|Step \d+)/m.test(section.content),
      hasExamples: /(example|instance|such as|for instance)/i.test(
        section.content
      ),
      keyTopics: extractKeyTopics(section.content),
    };
  }

  return sections;
}

function detectSectionType(title: string): string {
  const titleLower = title.toLowerCase();

  for (const [type, config] of Object.entries(SECTION_PATTERNS)) {
    for (const keyword of config.keywords) {
      if (titleLower.includes(keyword)) {
        return type;
      }
    }
  }

  return "content";
}

function extractKeyTopics(content: string): string[] {
  // Simple topic extraction based on capitalized phrases and repeated terms
  const topics = new Set<string>();

  // Find capitalized phrases (potential topics)
  const capitalizedPhrases = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (capitalizedPhrases) {
    capitalizedPhrases.forEach((phrase) => {
      if (
        phrase.length > 3 &&
        !phrase.match(/^(The|This|That|These|Those|A|An)$/)
      ) {
        topics.add(phrase);
      }
    });
  }

  return Array.from(topics).slice(0, 5);
}

function findSectionByQuery(
  sections: ContentSection[],
  query: string
): ContentSection[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  // Score each section based on query relevance
  const scoredSections = sections.map((section) => {
    let score = 0;
    const sectionLower = (section.title + " " + section.content).toLowerCase();

    // Check for exact phrase match
    if (sectionLower.includes(queryLower)) {
      score += 10;
    }

    // Check for individual word matches
    for (const word of queryWords) {
      if (sectionLower.includes(word)) {
        score += 2;
      }
    }

    // Bonus for title matches
    if (section.title.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    return { section, score };
  });

  // Sort by score and return top matches
  return scoredSections
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ...s.section, relevance: s.score }));
}

export const smartSectionsTool: Tool = {
  name: "noverload_smart_sections",
  description:
    "Extract and navigate specific sections from large documents. Finds natural content boundaries, identifies section types, and retrieves specific parts by semantic meaning.",
  inputSchema: {
    type: "object",
    properties: {
      contentId: {
        type: "string",
        description: "ID of the content to section",
      },
      query: {
        type: "string",
        description: "Optional: Extract specific section matching this query",
      },
      maxSections: {
        type: "number",
        default: 10,
        description: "Maximum number of sections to return",
      },
      sectionType: {
        type: "string",
        enum: [
          "all",
          "introduction",
          "methods",
          "results",
          "examples",
          "conclusion",
          "code",
          "steps",
        ],
        default: "all",
        description: "Type of sections to extract",
      },
    },
    required: ["contentId"],
  },
  modifies: false,

  handler: async (client: NoverloadClient, args: unknown) => {
    const input = inputSchema.parse(args);

    try {
      // Get the content
      const content = await client.getContent(input.contentId);

      if (!content) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Content not found with ID: ${input.contentId}`,
            },
          ],
          error: true,
        };
      }

      // Get the raw text for sectioning
      const rawText = content.rawText || "";

      if (!rawText) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ No text content available for sectioning in this item.`,
            },
          ],
          data: {
            contentId: input.contentId,
            sections: [],
          },
        };
      }

      // Detect sections
      let sections = detectSections(rawText, input.sectionType);

      // Filter by type if specified
      if (input.sectionType !== "all") {
        sections = sections.filter((s) => s.type === input.sectionType);
      }

      // Find specific sections by query if provided
      if (input.query) {
        sections = findSectionByQuery(sections, input.query);
      }

      // Limit sections
      sections = sections.slice(0, input.maxSections);

      // Format response
      let responseText = `📑 **Content Sections**\n\n`;
      responseText += `*${content.title || "Untitled"}*\n`;

      const icon =
        content.contentType === "youtube"
          ? "📺"
          : content.contentType === "x_twitter"
            ? "𝕏"
            : content.contentType === "reddit"
              ? "🟠"
              : content.contentType === "pdf"
                ? "📄"
                : "📖";
      responseText += `${icon} [View Original](${content.url})\n\n`;

      if (input.query) {
        responseText += `🔍 Searching for: "${input.query}"\n\n`;
      }

      responseText += `Found ${sections.length} section${sections.length !== 1 ? "s" : ""}:\n\n`;

      // Display sections
      for (const section of sections) {
        const sectionIcon =
          section.type === "introduction"
            ? "📝"
            : section.type === "methods"
              ? "⚙️"
              : section.type === "results"
                ? "📊"
                : section.type === "examples"
                  ? "💡"
                  : section.type === "conclusion"
                    ? "🎯"
                    : section.type === "code"
                      ? "💻"
                      : section.type === "steps"
                        ? "📋"
                        : "📄";

        responseText += `## ${sectionIcon} ${section.title}\n`;
        responseText += `*Type: ${section.type} | ~${section.tokenCount} tokens*\n`;

        if (section.relevance) {
          responseText += `*Relevance: ${section.relevance}/20*\n`;
        }

        // Add metadata badges
        if (section.metadata) {
          const badges = [];
          if (section.metadata.hasCode) badges.push("Has Code");
          if (section.metadata.hasSteps) badges.push("Has Steps");
          if (section.metadata.hasExamples) badges.push("Has Examples");
          if (badges.length > 0) {
            responseText += `*Features: ${badges.join(" | ")}*\n`;
          }
          if (
            section.metadata.keyTopics &&
            section.metadata.keyTopics.length > 0
          ) {
            responseText += `*Topics: ${section.metadata.keyTopics.join(", ")}*\n`;
          }
        }

        responseText += `\n`;

        // Show content preview (first 500 chars)
        const preview = section.content.substring(0, 500);
        responseText += `${preview}${section.content.length > 500 ? "..." : ""}\n\n`;

        responseText += `---\n\n`;
      }

      // Add summary
      responseText += `**📊 Summary:**\n`;
      responseText += `- Total sections: ${sections.length}\n`;
      responseText += `- Total tokens: ~${sections.reduce((sum, s) => sum + s.tokenCount, 0)}\n`;

      const sectionTypes = [...new Set(sections.map((s) => s.type))];
      responseText += `- Section types: ${sectionTypes.join(", ")}\n`;

      if (sections.length === 0 && input.query) {
        responseText += `\n💡 **Tip:** Try a broader search term or browse all sections without a query.`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        data: {
          contentId: input.contentId,
          contentTitle: content.title,
          sections: sections.map((s) => ({
            id: s.id,
            type: s.type,
            title: s.title,
            tokenCount: s.tokenCount,
            relevance: s.relevance,
            metadata: s.metadata,
          })),
          totalSections: sections.length,
          query: input.query,
        },
      };
    } catch (error) {
      console.error("Smart sections error:", error);

      return {
        content: [
          {
            type: "text",
            text: `❌ Error extracting sections: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        error: true,
      };
    }
  },
};
