import { describe, expect, test } from "bun:test";
import { ENV } from "./environment";

describe("environment configuration", () => {
  describe("Unit -> environment structure", () => {
    test("exports ENV object", () => {
      expect(ENV).toBeDefined();
      expect(typeof ENV).toBe("object");
    });

    test("includes NODE_ENV property", () => {
      expect(ENV.NODE_ENV).toBeDefined();
      expect(["development", "production", "test"]).toContain(ENV.NODE_ENV);
    });

    test("includes PORT property as number", () => {
      expect(typeof ENV.PORT).toBe("number");
      expect(ENV.PORT).toBeGreaterThan(0);
    });

    test("includes OPENAI_API_KEY property", () => {
      expect(ENV.OPENAI_API_KEY).toBeDefined();
      expect(typeof ENV.OPENAI_API_KEY).toBe("string");
    });

    test("includes FIREBASE_WEB_API_KEY property", () => {
      expect(ENV.FIREBASE_WEB_API_KEY).toBeDefined();
      expect(typeof ENV.FIREBASE_WEB_API_KEY).toBe("string");
    });

    test("includes DATABASE_URL property", () => {
      expect(ENV.DATABASE_URL).toBeDefined();
      expect(typeof ENV.DATABASE_URL).toBe("string");
    });
  });

  describe("Unit -> LangSmith configuration", () => {
    test("includes optional LANGSMITH_API_KEY property", () => {
      // Can be undefined or string
      if (ENV.LANGSMITH_API_KEY !== undefined) {
        expect(typeof ENV.LANGSMITH_API_KEY).toBe("string");
      }
    });

    test("includes optional LANGSMITH_ENDPOINT property", () => {
      // Can be undefined or string
      if (ENV.LANGSMITH_ENDPOINT !== undefined) {
        expect(typeof ENV.LANGSMITH_ENDPOINT).toBe("string");
      }
    });

    test("includes optional LANGSMITH_PROJECT property", () => {
      // Can be undefined or string
      if (ENV.LANGSMITH_PROJECT !== undefined) {
        expect(typeof ENV.LANGSMITH_PROJECT).toBe("string");
      }
    });
  });

  describe("Unit -> metrics configuration", () => {
    test("includes SEARCH_METRICS_SAMPLE_RATE as number", () => {
      expect(typeof ENV.SEARCH_METRICS_SAMPLE_RATE).toBe("number");
    });

    test("SEARCH_METRICS_SAMPLE_RATE is within valid range (0.0 to 1.0)", () => {
      expect(ENV.SEARCH_METRICS_SAMPLE_RATE).toBeGreaterThanOrEqual(0.0);
      expect(ENV.SEARCH_METRICS_SAMPLE_RATE).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Unit -> cache configuration", () => {
    test("includes EMBEDDING_CACHE_MAX_SIZE as number", () => {
      expect(typeof ENV.EMBEDDING_CACHE_MAX_SIZE).toBe("number");
      expect(ENV.EMBEDDING_CACHE_MAX_SIZE).toBeGreaterThan(0);
    });

    test("includes HYBRID_SEARCH_METHOD as string", () => {
      expect(typeof ENV.HYBRID_SEARCH_METHOD).toBe("string");
      expect(["manual", "mongo"]).toContain(ENV.HYBRID_SEARCH_METHOD);
    });
  });

  describe("Unit -> optional Firebase configuration", () => {
    test("includes FIREBASE_CONFIG_BASE64 property", () => {
      // Can be undefined or string
      if (ENV.FIREBASE_CONFIG_BASE64 !== undefined) {
        expect(typeof ENV.FIREBASE_CONFIG_BASE64).toBe("string");
      }
    });

    test("includes GOOGLE_APPLICATION_CREDENTIALS property", () => {
      // Can be undefined or string
      if (ENV.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
        expect(typeof ENV.GOOGLE_APPLICATION_CREDENTIALS).toBe("string");
      }
    });
  });

  describe("Unit -> optional Sentry configuration", () => {
    test("includes SENTRY_DSN property", () => {
      // Can be undefined or string
      if (ENV.SENTRY_DSN !== undefined) {
        expect(typeof ENV.SENTRY_DSN).toBe("string");
      }
    });
  });

  describe("Unit -> type safety", () => {
    test("ENV object is readonly (as const)", () => {
      // Attempting to modify should fail in TypeScript
      // This test just verifies the structure exists
      expect(ENV).toBeDefined();
    });

    test("all required properties are present", () => {
      const requiredProps = [
        "NODE_ENV",
        "PORT",
        "OPENAI_API_KEY",
        "FIREBASE_WEB_API_KEY",
        "DATABASE_URL",
        "SEARCH_METRICS_SAMPLE_RATE",
        "EMBEDDING_CACHE_MAX_SIZE",
        "HYBRID_SEARCH_METHOD",
      ];

      for (const prop of requiredProps) {
        expect(ENV).toHaveProperty(prop);
      }
    });

    test("all optional properties are defined on the object", () => {
      const optionalProps = [
        "FIREBASE_CONFIG_BASE64",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "LANGSMITH_API_KEY",
        "LANGSMITH_ENDPOINT",
        "LANGSMITH_PROJECT",
        "SENTRY_DSN",
      ];

      for (const prop of optionalProps) {
        expect(ENV).toHaveProperty(prop);
      }
    });
  });
});
