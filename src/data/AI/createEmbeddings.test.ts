import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("createEmbeddings", () => {
  // Declare mock variables with 'let'
  let mockGetModelByName: ReturnType<typeof mock>;
  let mockOpenAIEmbeddings: ReturnType<typeof mock>;
  let mockEncodingForModel: ReturnType<typeof mock>;
  let mockEncoder: {
    encode: ReturnType<typeof mock>;
    decode: ReturnType<typeof mock>;
    free: ReturnType<typeof mock>;
  };
  let createEmbeddings: typeof import("./createEmbeddings").createEmbeddings;

  // Default mock data
  const defaultModel = {
    modelName: "text-embedding-3-small",
    contextWindow: 8191,
    maxOutputTokens: 0,
    inputCostPer1MTokens: 0.02,
    outputCostPer1MTokens: 0,
  };

  const defaultEmbeddingResult = [0.1, 0.2, 0.3, 0.4, 0.5];
  const defaultQuery = "What is the meaning of life?";

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockGetModelByName = mock();
    const mockEmbedQuery = mock();
    mockOpenAIEmbeddings = mock(() => ({
      embedQuery: mockEmbedQuery,
    }));

    const mockEncode = mock();
    const mockDecode = mock();
    const mockFree = mock();
    mockEncoder = {
      encode: mockEncode,
      decode: mockDecode,
      free: mockFree,
    };
    mockEncodingForModel = mock(() => mockEncoder);

    // Set up module mocks INSIDE beforeEach
    mock.module("./modelList", () => ({
      getModelByName: mockGetModelByName,
    }));

    mock.module("@langchain/openai", () => ({
      OpenAIEmbeddings: mockOpenAIEmbeddings,
    }));

    mock.module("tiktoken", () => ({
      encoding_for_model: mockEncodingForModel,
    }));

    // Dynamically import the module under test
    const module = await import("./createEmbeddings");
    createEmbeddings = module.createEmbeddings;

    // Configure default mock behavior AFTER import
    mockGetModelByName.mockReturnValue(defaultModel);
    mockEmbedQuery.mockResolvedValue(defaultEmbeddingResult);
    mockEncoder.encode.mockReturnValue(new Uint32Array([1, 2, 3, 4, 5]));
    mockEncoder.decode.mockReturnValue(new Uint8Array());
  });

  afterEach(() => {
    mock.restore();
  });

  test("Unit -> createEmbeddings generates embeddings for valid query", async () => {
    const result = await createEmbeddings(defaultQuery);

    expect(mockGetModelByName).toHaveBeenCalledWith("text-embedding-3-small");
    expect(mockOpenAIEmbeddings).toHaveBeenCalledWith({
      apiKey: process.env.OPENAI_API_KEY,
      model: defaultModel.modelName,
    });
    expect(mockEncodingForModel).toHaveBeenCalledWith("text-embedding-3-small");
    expect(mockEncoder.encode).toHaveBeenCalledWith(defaultQuery);
    expect(mockEncoder.free).toHaveBeenCalled();
    expect(result).toEqual(defaultEmbeddingResult);
  });

  test("Unit -> createEmbeddings returns empty array for empty query", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await createEmbeddings("   ");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Empty search query provided"
      );
      expect(result).toEqual([]);
      expect(mockEncoder.free).not.toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createEmbeddings truncates query exceeding context window", async () => {
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = mock();
    console.warn = mockConsoleWarn;

    const longTokenArray = new Uint32Array(10000);
    const _truncatedTokenArray = new Uint32Array(8191);
    const truncatedText = new Uint8Array([
      116, 114, 117, 110, 99, 97, 116, 101, 100,
    ]);

    mockEncoder.encode.mockReturnValueOnce(longTokenArray);
    mockEncoder.encode.mockReturnValueOnce(longTokenArray);
    mockEncoder.decode.mockReturnValue(truncatedText);

    try {
      const result = await createEmbeddings("very long query");

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `Query exceeds context window of ${defaultModel.contextWindow} tokens (actual: ${longTokenArray.length}). Truncating query.`
      );
      expect(mockEncoder.free).toHaveBeenCalled();
      expect(result).toEqual(defaultEmbeddingResult);
    } finally {
      console.warn = originalConsoleWarn;
    }
  });

  test("Unit -> createEmbeddings frees encoder even if error occurs during encoding", async () => {
    const encodingError = new Error("Encoding failed");
    mockEncoder.encode.mockImplementation(() => {
      throw encodingError;
    });

    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    try {
      const result = await createEmbeddings(defaultQuery);

      expect(mockEncoder.free).toHaveBeenCalled();
      expect(result).toEqual([]);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createEmbeddings returns empty array when embedQuery fails", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const embeddingError = new Error("API rate limit exceeded");
    const mockEmbedQuery = mock(() => {
      throw embeddingError;
    });
    mockOpenAIEmbeddings.mockReturnValue({
      embedQuery: mockEmbedQuery,
    });

    try {
      const result = await createEmbeddings(defaultQuery);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error generating query embeddings:",
        embeddingError
      );
      expect(result).toEqual([]);
      expect(mockEncoder.free).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createEmbeddings returns empty array when getModelByName fails", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const modelError = new Error("Model not found");
    mockGetModelByName.mockImplementation(() => {
      throw modelError;
    });

    try {
      const result = await createEmbeddings(defaultQuery);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error generating query embeddings:",
        modelError
      );
      expect(result).toEqual([]);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test("Unit -> createEmbeddings handles query with whitespace", async () => {
    const queryWithWhitespace = "  query with spaces  ";
    const result = await createEmbeddings(queryWithWhitespace);

    expect(mockEncoder.encode).toHaveBeenCalledWith(queryWithWhitespace);
    expect(result).toEqual(defaultEmbeddingResult);
  });
});
