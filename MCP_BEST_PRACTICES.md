# Noverload MCP Best Practices

## 🚨 Token Management Guidelines

### Understanding Token Costs

When using Noverload MCP with your LLM, be aware that full content can consume significant tokens:

- **Article/Blog Post**: 1,000 - 5,000 tokens
- **YouTube Transcript**: 5,000 - 20,000 tokens  
- **PDF Document**: 10,000 - 50,000 tokens
- **Reddit Thread**: 2,000 - 10,000 tokens

### Smart Usage Patterns

#### 1. **Always Start with Summaries** (Recommended)

```javascript
// Good: Search without full content first
search_content({
  query: "productivity tips",
  limit: 5,
  includeFullContent: false  // Default, returns summaries only
})
```

#### 2. **Estimate Before Requesting Full Content**

```javascript
// First: Check token count
estimate_search_tokens({
  query: "machine learning",
  limit: 10
})
// Returns: { estimatedTokens: 45000, recommendation: "..." }

// Then: Adjust your request based on estimate
search_content({
  query: "machine learning",
  limit: 3,  // Reduced from 10
  includeFullContent: true
})
```

#### 3. **Use Progressive Retrieval**

```javascript
// Step 1: Get summaries and metadata
results = search_content({ query: "AI tools", limit: 10 })

// Step 2: Review summaries and relevance scores
// Step 3: Get full content for specific items only
get_content_details({ contentId: "most-relevant-id" })
```

#### 4. **Batch Smartly**

```javascript
// Use batch endpoint with token limits
batch_get_content({
  ids: ["id1", "id2", "id3"],
  includeFullContent: true
})
// Automatically manages token usage
```

## 📊 Cost-Aware Strategies

### Context Window Management

Most LLMs have context limits:
- **GPT-4 Turbo**: 128k tokens
- **Claude 3**: 200k tokens
- **Gemini Pro**: 32k tokens

**Rule of Thumb**: Keep MCP content under 25% of your context window to leave room for conversation.

### Filtering Strategies

#### By Content Type
```javascript
// PDFs and YouTube tend to be longest
search_content({
  query: "quick tips",
  contentTypes: ["article", "x_post"],  // Shorter content
  limit: 10
})
```

#### By Date
```javascript
// Recent content might be more relevant
search_content({
  query: "AI news",
  dateFrom: "2024-01-01",
  limit: 5
})
```

#### By Tags
```javascript
// Focused results
search_content({
  query: "learning",
  tags: ["productivity", "tools"],
  limit: 5
})
```

## 🎯 Common Patterns

### Research Assistant Pattern
```javascript
// 1. Broad search for overview
const overview = await search_content({
  query: "quantum computing",
  limit: 20,
  includeFullContent: false
});

// 2. Synthesize key themes
const synthesis = await synthesize_content({
  query: "quantum computing applications",
  maxSources: 10
});

// 3. Deep dive on specific aspect
const detailed = await get_content_details({
  contentId: "specific-article-id"
});
```

### Daily Briefing Pattern
```javascript
// Get recent summaries only
const briefing = await search_content({
  query: "important",
  dateFrom: "2024-01-20",
  limit: 10,
  includeFullContent: false  // Keep it brief
});
```

### Deep Analysis Pattern
```javascript
// When you need full content for thorough analysis
// 1. Estimate first
const estimate = await estimate_search_tokens({
  query: "machine learning best practices",
  limit: 5
});

// 2. If reasonable (<30k tokens), get full content
if (estimate.totals.estimatedTokens < 30000) {
  const full = await search_content({
    query: "machine learning best practices",
    limit: 5,
    includeFullContent: true
  });
}
```

## ⚠️ Warning Signs

Watch for these in API responses:

```javascript
{
  metadata: {
    contentSizeWarning: "⚠️ VERY LARGE: ~75k tokens",
    safetySuggestion: "Consider reducing limit to 2 results",
    costEstimate: {
      gpt4: "$2.25",
      claude35Sonnet: "$1.13"
    }
  }
}
```

## 🚀 Pro Tips

1. **Use Caching**: If you're analyzing the same content repeatedly, save the results locally
2. **Batch by Type**: Group similar content types together for better context
3. **Leverage Metadata**: Use the metadata to decide what needs full content
4. **Smart Synthesis**: Let `synthesize_content` do the heavy lifting across sources
5. **Progressive Enhancement**: Start simple, add detail as needed

## 📈 Token Usage Examples

| Operation | Typical Tokens | Cost (GPT-4) |
|-----------|---------------|--------------|
| List 10 summaries | 2,000 | $0.06 |
| Search 5 with full content | 25,000 | $0.75 |
| Get single YouTube transcript | 15,000 | $0.45 |
| Batch 3 articles | 10,000 | $0.30 |
| Synthesize 10 sources | 5,000 | $0.15 |

## 🎓 Example Workflow

```python
# Efficient research workflow
def research_topic(topic):
    # 1. Start with estimate (practically free)
    estimate = estimate_search_tokens(query=topic, limit=10)
    print(f"Full content would use {estimate['totals']['estimatedTokens']} tokens")
    
    # 2. Get summaries first (cheap, ~2k tokens)
    summaries = search_content(query=topic, limit=10, includeFullContent=False)
    
    # 3. Identify top 2-3 most relevant
    top_items = sorted(summaries['results'], 
                      key=lambda x: x['relevanceScore'], 
                      reverse=True)[:3]
    
    # 4. Get full content for just those (controlled cost)
    detailed = batch_get_content(
        ids=[item['id'] for item in top_items],
        includeFullContent=True
    )
    
    return detailed
```

Remember: **Start small, expand as needed!** Your LLM's context window is precious real estate. 🏗️