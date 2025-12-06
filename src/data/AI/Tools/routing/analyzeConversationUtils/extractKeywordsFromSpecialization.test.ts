import { describe, expect, test } from "bun:test";
import { extractKeywordsFromSpecialization } from "./extractKeywordsFromSpecialization";

describe("extractKeywordsFromSpecialization", () => {
  test("Unit -> extractKeywordsFromSpecialization extracts simple keywords", () => {
    const result = extractKeywordsFromSpecialization(
      "character creation and management"
    );

    expect(result).toEqual(["character", "creation", "management"]);
  });

  test("Unit -> extractKeywordsFromSpecialization removes stop words", () => {
    const result = extractKeywordsFromSpecialization(
      "general questions and answers"
    );

    // "and" should be filtered out as a stop word
    expect(result).toEqual(["general", "questions", "answers"]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles hyphenated words", () => {
    const result = extractKeywordsFromSpecialization(
      "location-based campaign assets"
    );

    expect(result).toEqual(["location", "based", "campaign", "assets"]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles comma-separated lists", () => {
    const result = extractKeywordsFromSpecialization(
      "towns, dungeons, and landmarks"
    );

    expect(result).toEqual(["towns", "dungeons", "landmarks"]);
  });

  test("Unit -> extractKeywordsFromSpecialization converts to lowercase", () => {
    const result = extractKeywordsFromSpecialization(
      "Character Creation And Management"
    );

    expect(result).toEqual(["character", "creation", "management"]);
  });

  test("Unit -> extractKeywordsFromSpecialization removes duplicates", () => {
    const result = extractKeywordsFromSpecialization(
      "campaign campaign assets campaign"
    );

    expect(result).toEqual(["campaign", "assets"]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles empty string", () => {
    const result = extractKeywordsFromSpecialization("");

    expect(result).toEqual([]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles only stop words", () => {
    const result = extractKeywordsFromSpecialization("and the of a an");

    expect(result).toEqual([]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles multiple delimiters", () => {
    const result = extractKeywordsFromSpecialization(
      "location-based/campaign_assets (towns, dungeons)"
    );

    expect(result).toEqual([
      "location",
      "based",
      "campaign",
      "assets",
      "towns",
      "dungeons",
    ]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles real agent specialization", () => {
    const result = extractKeywordsFromSpecialization(
      "location-based campaign assets like towns, dungeons, and landmarks"
    );

    expect(result).toEqual([
      "location",
      "based",
      "campaign",
      "assets",
      "like",
      "towns",
      "dungeons",
      "landmarks",
    ]);
  });

  test("Unit -> extractKeywordsFromSpecialization preserves order (first occurrence)", () => {
    const result = extractKeywordsFromSpecialization(
      "creation management creation"
    );

    // "creation" appears first, so it should come before "management"
    expect(result).toEqual(["creation", "management"]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles single word", () => {
    const result = extractKeywordsFromSpecialization("routing");

    expect(result).toEqual(["routing"]);
  });

  test("Unit -> extractKeywordsFromSpecialization handles extra whitespace", () => {
    const result = extractKeywordsFromSpecialization(
      "  character   creation     management  "
    );

    expect(result).toEqual(["character", "creation", "management"]);
  });
});
