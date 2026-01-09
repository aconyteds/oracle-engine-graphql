import { describe, expect, test } from "bun:test";
import { detectQueryIntent } from "./detectQueryIntent";

describe("detectQueryIntent", () => {
  describe("text search (name-like queries)", () => {
    test("Unit -> detectQueryIntent returns text for single proper noun", () => {
      expect(detectQueryIntent("Gandalf")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for multi-word proper noun", () => {
      expect(detectQueryIntent("Dragon Tavern")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for title-style name", () => {
      expect(detectQueryIntent("Lord Vex")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for short query without articles", () => {
      expect(detectQueryIntent("red dragon")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for two-word query", () => {
      expect(detectQueryIntent("magic sword")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for single lowercase word", () => {
      expect(detectQueryIntent("tavern")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for empty string", () => {
      expect(detectQueryIntent("")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for whitespace only", () => {
      expect(detectQueryIntent("   ")).toBe("text");
    });

    test("Unit -> detectQueryIntent returns text for three-word query without articles", () => {
      expect(detectQueryIntent("old stone bridge")).toBe("text");
    });
  });

  describe("vector search (descriptive queries)", () => {
    test("Unit -> detectQueryIntent returns vector for query with 'the'", () => {
      expect(detectQueryIntent("the old wizard")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for query with 'who'", () => {
      expect(detectQueryIntent("someone who knows magic")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for query with 'a'", () => {
      expect(detectQueryIntent("a tavern in town")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for query with 'with'", () => {
      expect(detectQueryIntent("character with fire magic")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for question starting with 'who'", () => {
      expect(detectQueryIntent("who lives in the tower")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for question starting with 'where'", () => {
      expect(detectQueryIntent("where can I find healing")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for question starting with 'what'", () => {
      expect(detectQueryIntent("what happened at the battle")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for long descriptive query", () => {
      expect(
        detectQueryIntent("the innkeeper who knows about the missing prince")
      ).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for query with 'from'", () => {
      expect(detectQueryIntent("travelers from the north")).toBe("vector");
    });

    test("Unit -> detectQueryIntent returns vector for four+ word query", () => {
      expect(detectQueryIntent("ancient ruins near mountain pass")).toBe(
        "vector"
      );
    });
  });

  describe("edge cases", () => {
    test("Unit -> detectQueryIntent handles title-case with article", () => {
      // "The Wizard" looks like a proper noun/title (all caps), treated as name
      expect(detectQueryIntent("The Wizard")).toBe("text");
    });

    test("Unit -> detectQueryIntent handles lowercase with article", () => {
      // "the wizard" has article + lowercase, so vector
      expect(detectQueryIntent("the wizard")).toBe("vector");
    });

    test("Unit -> detectQueryIntent handles location names with 'in'", () => {
      // Contains descriptive word 'in'
      expect(detectQueryIntent("castle in the mountains")).toBe("vector");
    });

    test("Unit -> detectQueryIntent handles possessive patterns", () => {
      // Short, no articles
      expect(detectQueryIntent("Elara's shop")).toBe("text");
    });

    test("Unit -> detectQueryIntent handles numeric identifiers", () => {
      expect(detectQueryIntent("Room 42")).toBe("text");
    });
  });
});
