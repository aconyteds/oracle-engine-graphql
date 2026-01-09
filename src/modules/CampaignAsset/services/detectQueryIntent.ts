/**
 * Detects whether a search query is likely a name-based lookup (text search)
 * or a descriptive/conceptual query (vector search).
 *
 * Used for smart routing when the UI passes the same value as both query and keywords.
 *
 * @param input - The search query string
 * @returns "text" for name-like queries, "vector" for descriptive queries
 */
export function detectQueryIntent(input: string): "text" | "vector" {
  const trimmed = input.trim();

  if (!trimmed) {
    return "text";
  }

  const words = trimmed.split(/\s+/);

  // Descriptive words that suggest semantic/conceptual search
  const hasDescriptiveWords =
    /\b(the|who|that|with|from|in|at|a|an|where|which|what)\b/i.test(trimmed);

  // Short queries (1-3 words) without descriptive words are likely names
  const isShort = words.length <= 3;

  // Pattern matching for proper nouns / names
  // Matches: "Gandalf", "Dragon Tavern", "Lord Vex"
  // Does NOT match: "the old wizard", "a tavern in town"
  const looksLikeName = /^[A-Z][a-z]*(\s+[A-Z][a-z]*)*$/.test(trimmed);

  // Check for question-like patterns suggesting descriptive search
  const isQuestion = /^(who|what|where|which|how|why)\b/i.test(trimmed);

  // Favor text search for name-like queries
  if (looksLikeName) {
    return "text";
  }

  // Questions are descriptive
  if (isQuestion) {
    return "vector";
  }

  // Short queries without articles/prepositions are likely names
  if (isShort && !hasDescriptiveWords) {
    return "text";
  }

  // Longer queries or those with descriptive words use vector search
  return "vector";
}
