// Helper functions for content processing

export function chunkContent(text: string, targetTokenSize: number, maxTokens?: number): any[] {
  const words = text.split(/\s+/);
  const wordsPerChunk = Math.floor(targetTokenSize / 1.3); // Rough token estimation
  const chunks = [];
  let totalTokens = 0;
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const chunkText = chunkWords.join(' ');
    const chunkTokens = Math.ceil(chunkWords.length * 1.3);
    
    // Stop if we've reached the max token limit
    if (maxTokens && totalTokens + chunkTokens > maxTokens) {
      break;
    }
    
    chunks.push({
      index: chunks.length,
      text: chunkText,
      tokenCount: chunkTokens,
      startOffset: i,
      endOffset: Math.min(i + wordsPerChunk, words.length),
    });
    
    totalTokens += chunkTokens;
  }
  
  return chunks;
}

export function detectSections(text: string, contentType: string): any[] {
  const sections = [];
  
  // Simple section detection based on headers and paragraphs
  const lines = text.split('\n');
  let currentSection = { title: "Introduction", text: "", type: "intro", tokenCount: 0 };
  
  for (const line of lines) {
    // Detect headers (various formats)
    if (line.match(/^#{1,6}\s+/) || line.match(/^[A-Z][^.!?]*:$/) || (line.length < 100 && line.match(/^[A-Z]/))) {
      if (currentSection.text) {
        currentSection.tokenCount = Math.ceil(currentSection.text.split(/\s+/).length * 1.3);
        sections.push(currentSection);
      }
      currentSection = {
        title: line.replace(/^#+\s+/, '').replace(/:$/, ''),
        text: "",
        type: "section",
        tokenCount: 0,
      };
    } else {
      currentSection.text += line + "\n";
    }
  }
  
  // Add the last section
  if (currentSection.text) {
    currentSection.tokenCount = Math.ceil(currentSection.text.split(/\s+/).length * 1.3);
    sections.push(currentSection);
  }
  
  return sections;
}

export function extractKeyConceptsFromSearch(results: any[], topic: string): string[] {
  const concepts = new Map<string, number>();
  
  results.forEach(result => {
    // Extract from tags
    if (result.tags) {
      result.tags.forEach((tag: string) => {
        concepts.set(tag, (concepts.get(tag) || 0) + 2);
      });
    }
    
    // Extract from summary
    if (result.summary) {
      const summary = typeof result.summary === 'string' ? result.summary : result.summary.one_sentence;
      if (summary) {
        // Simple concept extraction from summary
        const words = summary.toLowerCase().split(/\s+/);
        const importantWords = words.filter((w: string) => w.length > 5 && !['about', 'through', 'between', 'during'].includes(w));
        importantWords.forEach((word: string) => {
          concepts.set(word, (concepts.get(word) || 0) + 1);
        });
      }
    }
  });
  
  // Sort by frequency and return top concepts
  return Array.from(concepts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([concept]) => concept)
    .filter(concept => concept.toLowerCase() !== topic.toLowerCase());
}

export function groupByPerspective(results: any[]): Record<string, any[]> {
  const perspectives: Record<string, any[]> = {};
  
  results.forEach(result => {
    // Group by content type as a simple perspective grouping
    const perspective = result.contentType || 'general';
    if (!perspectives[perspective]) {
      perspectives[perspective] = [];
    }
    perspectives[perspective].push(result);
  });
  
  return perspectives;
}

export function createTopicTimeline(results: any[]): any[] {
  // Sort by date and create timeline
  const sorted = results
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  return sorted.slice(0, 5).map(result => ({
    date: new Date(result.createdAt).toLocaleDateString(),
    title: result.title || "Untitled",
    insight: typeof result.summary === 'string' 
      ? result.summary.slice(0, 100) 
      : result.summary?.one_sentence?.slice(0, 100) || "No summary",
  }));
}

export function createLearningPath(results: any[], topic: string): any[] {
  // Create a simple learning path based on content
  const path = [];
  
  // Find introductory content
  const intro = results.find(r => 
    r.title?.toLowerCase().includes('introduction') ||
    r.title?.toLowerCase().includes('basics') ||
    r.title?.toLowerCase().includes('beginner')
  );
  
  if (intro) {
    path.push({
      title: intro.title || "Introduction",
      reason: "Start with foundational concepts",
      id: intro.id,
    });
  }
  
  // Add the most relevant content
  results
    .filter(r => r.id !== intro?.id)
    .slice(0, 3)
    .forEach(result => {
      path.push({
        title: result.title || "Untitled",
        reason: "Build on core concepts",
        id: result.id,
      });
    });
  
  return path;
}