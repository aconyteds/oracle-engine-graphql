import { describe, expect, test } from "bun:test";
import { plotCreationBestPractices } from "./plotCreationBestPractices";

describe("plotCreationBestPractices", () => {
  test("Unit -> plotCreationBestPractices returns comprehensive guidance", async () => {
    const result = await plotCreationBestPractices();

    expect(result).toContain("WHAT MAKES A GREAT PLOT");
    expect(result).toContain("STORY FRAMEWORKS");
    expect(result).toContain("EXAMPLE PLOTS");
    expect(result).toContain("KEY TAKEAWAYS");
    expect(result).toContain("COMMON PITFALLS");
    expect(result).toContain("The Missing Merchant Prince");
    expect(result).toContain("Siege of Thornwatch");
    expect(result).toContain("dmNotes");
  });

  test("Unit -> plotCreationBestPractices includes plot status examples", async () => {
    const result = await plotCreationBestPractices();

    expect(result).toContain("InProgress");
    expect(result).toContain("TimeSensitive");
    expect(result).toContain("Critical");
  });

  test("Unit -> plotCreationBestPractices includes NPC and location relationship guidance", async () => {
    const result = await plotCreationBestPractices();

    // Check that the examples mention NPCs and locations for relationship context
    expect(result).toContain("KEY NPCs:");
    expect(result).toContain("LOCATIONS:");
    expect(result).toContain("NPC/Location Links");
  });
});
