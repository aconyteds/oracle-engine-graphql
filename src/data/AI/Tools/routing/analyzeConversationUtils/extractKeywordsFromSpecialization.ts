/**
 * Stop words to filter out from keyword extraction.
 * These are common English words that don't contribute meaningful semantic value.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "will",
  "with",
]);

/**
 * Extracts keywords from an agent's specialization string.
 *
 * This function:
 * 1. Converts the specialization to lowercase
 * 2. Splits on whitespace and common delimiters
 * 3. Removes stop words (common English words like "and", "the", "of")
 * 4. Filters out empty strings
 * 5. Returns unique keywords
 *
 * @param specialization - The agent's specialization description (e.g., "character creation and management")
 * @returns Array of lowercase keywords (e.g., ["character", "creation", "management"])
 *
 * @example
 * ```typescript
 * extractKeywordsFromSpecialization("character creation and management");
 * // Returns: ["character", "creation", "management"]
 *
 * extractKeywordsFromSpecialization("location-based campaign assets like towns, dungeons, and landmarks");
 * // Returns: ["location", "based", "campaign", "assets", "like", "towns", "dungeons", "landmarks"]
 * ```
 */
export function extractKeywordsFromSpecialization(
  specialization: string
): string[] {
  // Convert to lowercase
  const normalized = specialization.toLowerCase();

  // Split on whitespace, hyphens, commas, and other common delimiters
  const tokens = normalized.split(/[\s,\-_/()]+/);

  // Filter out stop words and empty strings, then get unique values
  const keywords = tokens
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .filter((value, index, array) => array.indexOf(value) === index); // Unique values

  return keywords;
}
