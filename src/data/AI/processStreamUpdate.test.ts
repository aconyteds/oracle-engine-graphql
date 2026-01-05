import { beforeEach, describe, expect, mock, test } from "bun:test";

describe("processStreamUpdate", () => {
  let mockYieldMessage: ReturnType<typeof mock>;
  let processStreamUpdate: typeof import("./processStreamUpdate").processStreamUpdate;

  beforeEach(async () => {
    // Restore mocks
    mock.restore();

    // Create fresh mock instances
    mockYieldMessage = mock();

    // Dynamically import the module under test
    const module = await import("./processStreamUpdate");
    processStreamUpdate = module.processStreamUpdate;
  });

  test("Unit -> processStreamUpdate skips model_request step with tool calls", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            tool_calls: [
              { name: "create_location", args: { name: "Tavern" } },
              { name: "create_npc", args: { name: "Barkeep" } },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Tool calls are no longer processed by processStreamUpdate
    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate skips model_request step without tool calls or contentBlocks", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            content: "I will create a location for you",
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate skips tools step", async () => {
    const chunk = {
      tools: {
        messages: [
          {
            type: "tool",
            name: "create_location",
            content: "Location created successfully",
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles empty chunk", async () => {
    const chunk = {};

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles malformed chunk with missing messages", async () => {
    const chunk = {
      model_request: {},
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles empty messages array", async () => {
    const chunk = {
      model_request: {
        messages: [],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate skips single tool call", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            tool_calls: [
              { name: "find_campaign_asset", args: { query: "wizard" } },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Tool calls are no longer processed
    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate extracts reasoning from contentBlocks", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "reasoning",
                reasoning:
                  "I need to search for the NPC first to avoid duplicates",
              },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).toHaveBeenCalledTimes(1);
    expect(mockYieldMessage).toHaveBeenCalledWith({
      responseType: "Reasoning",
      content: "🧠 I need to search for the NPC first to avoid duplicates",
    });
  });

  test("Unit -> processStreamUpdate extracts multiple reasoning blocks", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "reasoning",
                reasoning: "First, I'll analyze the user's request",
              },
              {
                type: "reasoning",
                reasoning: "Then, I'll decide which tool to use",
              },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).toHaveBeenCalledTimes(2);
    expect(mockYieldMessage).toHaveBeenNthCalledWith(1, {
      responseType: "Reasoning",
      content: "🧠 First, I'll analyze the user's request",
    });
    expect(mockYieldMessage).toHaveBeenNthCalledWith(2, {
      responseType: "Reasoning",
      content: "🧠 Then, I'll decide which tool to use",
    });
  });

  test("Unit -> processStreamUpdate handles mixed contentBlocks with reasoning and text", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "reasoning",
                reasoning: "I need to verify the location exists",
              },
              {
                type: "text",
                text: "Let me check the database",
              },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Should only yield reasoning blocks, not text blocks
    expect(mockYieldMessage).toHaveBeenCalledTimes(1);
    expect(mockYieldMessage).toHaveBeenCalledWith({
      responseType: "Reasoning",
      content: "🧠 I need to verify the location exists",
    });
  });

  test("Unit -> processStreamUpdate handles both reasoning blocks and tool calls", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "reasoning",
                reasoning:
                  "The user wants to create a tavern, so I'll use create_location",
              },
            ],
            tool_calls: [
              { name: "create_location", args: { name: "The Prancing Pony" } },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Should only yield reasoning block, tool calls are no longer processed
    expect(mockYieldMessage).toHaveBeenCalledTimes(1);
    expect(mockYieldMessage).toHaveBeenCalledWith({
      responseType: "Reasoning",
      content:
        "🧠 The user wants to create a tavern, so I'll use create_location",
    });
  });

  test("Unit -> processStreamUpdate skips empty contentBlocks array", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles contentBlocks with only text blocks", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "text",
                text: "Here is the result",
              },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Should not yield anything for text-only blocks
    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles invalid content structure gracefully", async () => {
    const chunk = {
      model_request: "invalid content",
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles future thinking format", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            thinking: "I need to process this request carefully",
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).toHaveBeenCalledTimes(1);
    expect(mockYieldMessage).toHaveBeenCalledWith({
      responseType: "Reasoning",
      content: "🧠 I need to process this request carefully",
    });
  });

  test("Unit -> processStreamUpdate prefers contentBlocks over thinking", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "reasoning",
                reasoning: "ContentBlocks reasoning",
              },
            ],
            thinking: "Alternative thinking format",
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Should use contentBlocks (OpenAI format) when both are present
    expect(mockYieldMessage).toHaveBeenCalledTimes(1);
    expect(mockYieldMessage).toHaveBeenCalledWith({
      responseType: "Reasoning",
      content: "🧠 ContentBlocks reasoning",
    });
  });

  test("Unit -> processStreamUpdate skips empty reasoning content", async () => {
    const chunk = {
      model_request: {
        messages: [
          {
            type: "ai",
            contentBlocks: [
              {
                type: "reasoning",
                reasoning: "",
              },
            ],
          },
        ],
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    expect(mockYieldMessage).not.toHaveBeenCalled();
  });

  test("Unit -> processStreamUpdate handles agent step (ignored)", async () => {
    const chunk = {
      agent: {
        messages: [
          {
            type: "ai",
            content: "Final response",
          },
        ],
        structuredResponse: {
          targetAgent: "locationAgent",
          confidence: 0.95,
        },
      },
    };

    await processStreamUpdate(chunk, mockYieldMessage);

    // Agent steps should be ignored
    expect(mockYieldMessage).not.toHaveBeenCalled();
  });
});
