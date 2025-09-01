import { NoverloadClient, Content } from "../client.js";

export const resources = {
  async list(client: NoverloadClient) {
    const content = await client.listContent({ 
      status: "completed",
      limit: 100 
    });

    return content.map((item: Content) => ({
      uri: `noverload://content/${item.id}`,
      name: item.title || `${item.contentType} - ${item.id}`,
      description: item.description || item.summary || "Saved content",
      mimeType: "application/json",
    }));
  },

  async read(client: NoverloadClient, uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
    const match = uri.match(/^noverload:\/\/content\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const contentId = match[1];
    const content = await client.getContent(contentId);
    const actions = await client.listActions({ contentId });

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              content,
              actions,
              metadata: {
                url: content.url,
                type: content.contentType,
                processed: content.status === "completed",
                insights: content.keyInsights,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  },
};