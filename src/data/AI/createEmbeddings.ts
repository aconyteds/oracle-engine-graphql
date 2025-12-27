import { OpenAIEmbeddings } from "@langchain/openai";
import { encoding_for_model, TiktokenModel } from "tiktoken";

/**
 * Generates an embedding vector for a search query using OpenAI's text-embedding-3-small model.
 *
 *
 * @param query - The natural language search query
 * @returns Promise<number[]> - Embedding vector, or empty array on error
 */
export async function createEmbeddings(query: string): Promise<number[]> {
  const embeddingModel = {
    modelName: "text-embedding-3-small" as TiktokenModel,
    modelProvider: "openai",
    contextWindow: 8_191,
  };

  try {
    const embeddings = new OpenAIEmbeddings({
      model: embeddingModel.modelName,
    });

    let textToEmbed = query;

    if (!textToEmbed.trim()) {
      console.error("Empty search query provided");
      return [];
    }

    // Check token count and truncate if necessary
    const encoder = encoding_for_model(embeddingModel.modelName);
    try {
      const tokenCount = encoder.encode(textToEmbed).length;
      if (tokenCount > embeddingModel.contextWindow) {
        console.warn(
          `Query exceeds context window of ${embeddingModel.contextWindow} tokens (actual: ${tokenCount}). Truncating query.`
        );
        const tokens = encoder.encode(textToEmbed);
        const truncatedTokens = tokens.slice(0, embeddingModel.contextWindow);
        textToEmbed = new TextDecoder().decode(encoder.decode(truncatedTokens));
      }
    } finally {
      encoder.free();
    }

    const result = await embeddings.embedQuery(textToEmbed);
    return result;
  } catch (error) {
    console.error("Error generating query embeddings:", error);
    return [];
  }
}
