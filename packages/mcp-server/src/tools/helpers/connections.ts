// Helper functions for analyzing connections between content

export function analyzeConnections(contents: any[], connectionType: string): any[] {
  const connections = [];
  
  // Analyze pairs of content
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const conn = findConnection(contents[i], contents[j], connectionType);
      if (conn) {
        connections.push(conn);
      }
    }
  }
  
  return connections;
}

export function findConnection(content1: any, content2: any, type: string): any {
  // Simple connection detection based on shared concepts
  const tags1 = new Set(content1.tags || []);
  const tags2 = new Set(content2.tags || []);
  const sharedTags = Array.from(tags1).filter(t => tags2.has(t));
  
  if (sharedTags.length === 0 && type !== "contradictory") {
    return null;
  }
  
  return {
    source1: { id: content1.id, title: content1.title || "Untitled" },
    source2: { id: content2.id, title: content2.title || "Untitled" },
    type: sharedTags.length > 2 ? "strong" : "weak",
    relationship: sharedTags.length > 0 ? "complementary" : "independent",
    strength: sharedTags.length / Math.max(tags1.size, tags2.size),
    sharedConcepts: sharedTags,
    explanation: `Share ${sharedTags.length} common concepts`,
  };
}

export function groupConnectionsByType(connections: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  connections.forEach(conn => {
    const type = conn.relationship || "unknown";
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(conn);
  });
  
  return grouped;
}

export function getConnectionTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    complementary: "🤝",
    contradictory: "⚡",
    causal: "➡️",
    sequential: "📅",
    independent: "🔀",
  };
  return emojis[type] || "🔗";
}

export function getStrengthIndicator(strength: number): string {
  if (strength > 0.8) return "🟢🟢🟢 Very Strong";
  if (strength > 0.6) return "🟢🟢 Strong";
  if (strength > 0.4) return "🟡 Moderate";
  if (strength > 0.2) return "🟠 Weak";
  return "🔴 Very Weak";
}

export function calculateNetworkStats(connections: any[], contents: any[]): any {
  const connectionCounts = new Map<string, number>();
  
  connections.forEach(conn => {
    const id1 = conn.source1.id;
    const id2 = conn.source2.id;
    connectionCounts.set(id1, (connectionCounts.get(id1) || 0) + 1);
    connectionCounts.set(id2, (connectionCounts.get(id2) || 0) + 1);
  });
  
  const mostConnectedId = Array.from(connectionCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  const mostConnected = contents.find(c => c.id === mostConnectedId) || contents[0];
  
  return {
    mostConnected: {
      title: mostConnected?.title || "Unknown",
      connectionCount: connectionCounts.get(mostConnectedId) || 0,
    },
    centralTheme: connections[0]?.sharedConcepts?.[0] || "Unknown",
    density: connections.length > 0 ? "High" : "Low",
  };
}