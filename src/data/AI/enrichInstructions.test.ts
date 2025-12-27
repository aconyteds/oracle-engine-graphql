import { describe, expect, test } from "bun:test";
import { enrichInstructions } from "./enrichInstructions";
import type { CampaignMetadata } from "./types";

describe("enrichInstructions", () => {
  const baseSystemMessage = "You are a helpful assistant.";

  const defaultCampaignMetadata: CampaignMetadata = {
    name: "Lost Mines of Phandelver",
    setting: "Forgotten Realms",
    tone: "Classic Fantasy Adventure",
    ruleset: "D&D 5e",
  };

  test("Unit -> enrichInstructions wraps system message with standard context when no metadata provided", async () => {
    const result = await enrichInstructions({
      systemMessage: baseSystemMessage,
    });

    // Should include application context
    expect(result).toContain("<application-context>");
    expect(result).toContain("Oracle Engine");

    // Should include the system message wrapped in system-instructions
    expect(result).toContain("<system-instructions>");
    expect(result).toContain(baseSystemMessage);
    expect(result).toContain("</system-instructions>");

    // Should include formatting guidance
    expect(result).toContain("<formatting-guidance>");

    // Should include guardrails
    expect(result).toContain("<guardrails>");

    // Should NOT include campaign context
    expect(result).not.toContain("<campaign-context>");
  });

  test("Unit -> enrichInstructions uses default system message when none provided", async () => {
    const result = await enrichInstructions({
      campaignMetadata: defaultCampaignMetadata,
    });

    // Should include application context
    expect(result).toContain("<application-context>");

    // Should include default system instructions
    expect(result).toContain("<system-instructions>");
    expect(result).toContain("You are an AI assistant for Oracle Engine");

    // Should include campaign context
    expect(result).toContain("<campaign-context>");
    expect(result).toContain("Lost Mines of Phandelver");
  });

  test("Unit -> enrichInstructions enriches message with campaign metadata", async () => {
    const result = await enrichInstructions({
      systemMessage: baseSystemMessage,
      campaignMetadata: defaultCampaignMetadata,
    });

    // Should include application context
    expect(result).toContain("<application-context>");
    expect(result).toContain("Oracle Engine");

    // Should include system message
    expect(result).toContain(baseSystemMessage);

    // Should include campaign context with all metadata fields
    expect(result).toContain("<campaign-context>");
    expect(result).toContain("<campaign-setting>");
    expect(result).toContain("<name>Lost Mines of Phandelver</name>");
    expect(result).toContain("<setting>Forgotten Realms</setting>");
    expect(result).toContain("<tone>Classic Fantasy Adventure</tone>");
    expect(result).toContain("<ruleset>D&D 5e</ruleset>");
    expect(result).toContain("</campaign-setting>");
    expect(result).toContain("</campaign-context>");

    // Should include formatting guidance
    expect(result).toContain("<formatting-guidance>");

    // Should include guardrails
    expect(result).toContain("<guardrails>");
  });

  test("Unit -> enrichInstructions includes field-by-field guidance", async () => {
    const result = await enrichInstructions({
      systemMessage: baseSystemMessage,
      campaignMetadata: defaultCampaignMetadata,
    });

    expect(result).toContain("Campaign Context Guidance:");
    expect(result).toContain("Name: This is the campaign's title");
    expect(result).toContain("Setting: The world/universe context");
    expect(result).toContain("Tone: The emotional atmosphere");
    expect(result).toContain("Ruleset: The game system");
    expect(result).toContain("When creating or updating locations:");
  });

  test("Unit -> enrichInstructions handles special characters in metadata", async () => {
    const specialMetadata: CampaignMetadata = {
      name: 'Campaign with <special> & "characters"',
      setting: "Setting with 'quotes'",
      tone: "Tone & mood",
      ruleset: "D&D 5e",
    };

    const result = await enrichInstructions({
      systemMessage: baseSystemMessage,
      campaignMetadata: specialMetadata,
    });

    expect(result).toContain(
      '<name>Campaign with <special> & "characters"</name>'
    );
    expect(result).toContain("<setting>Setting with 'quotes'</setting>");
    expect(result).toContain("<tone>Tone & mood</tone>");
  });

  test("Unit -> enrichInstructions preserves multiline system messages", async () => {
    const multilineMessage = `You are a helpful assistant.

This is the second line.
This is the third line.`;

    const result = await enrichInstructions({
      systemMessage: multilineMessage,
      campaignMetadata: defaultCampaignMetadata,
    });

    expect(result).toContain(multilineMessage);
    expect(result).toContain("<campaign-setting>");
  });

  test("Unit -> enrichInstructions structures message with proper ordering", async () => {
    const result = await enrichInstructions({
      systemMessage: baseSystemMessage,
      campaignMetadata: defaultCampaignMetadata,
    });

    // Verify the order of sections
    const applicationContextIndex = result.indexOf("<application-context>");
    const systemInstructionsIndex = result.indexOf("<system-instructions>");
    const campaignContextIndex = result.indexOf("<campaign-context>");
    const formattingGuidanceIndex = result.indexOf("<formatting-guidance>");
    const guardrailsIndex = result.indexOf("<guardrails>");

    // Application context should come first
    expect(applicationContextIndex).toBeGreaterThan(-1);
    expect(applicationContextIndex).toBeLessThan(systemInstructionsIndex);

    // System instructions should come before campaign context
    expect(systemInstructionsIndex).toBeLessThan(campaignContextIndex);

    // Campaign context should come before formatting guidance
    expect(campaignContextIndex).toBeLessThan(formattingGuidanceIndex);

    // Formatting guidance should come before guardrails
    expect(formattingGuidanceIndex).toBeLessThan(guardrailsIndex);
  });
});
