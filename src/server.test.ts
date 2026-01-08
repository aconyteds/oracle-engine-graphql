import { describe, expect, test } from "bun:test";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import type { GraphQLFormattedError } from "graphql";
import { ALLOWED_ERROR_CODES, sanitizeGraphQLError } from "./server";

describe("sanitizeGraphQLError", () => {
  describe("Production mode", () => {
    test("Unit -> sanitizeGraphQLError sanitizes internal server errors", () => {
      const error: GraphQLFormattedError = {
        message: "MongoDB connection failed: authentication error",
        extensions: {
          code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
          stacktrace: ["Error at line 1", "at function foo"],
          exception: { code: "ERR_MONGO_AUTH" },
        },
        locations: [{ line: 1, column: 5 }],
        path: ["searchCampaignAssets"],
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.message).toBe("An internal server error occurred");
      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.INTERNAL_SERVER_ERROR
      );
      expect(result.extensions?.stacktrace).toBeUndefined();
      expect(result.extensions?.exception).toBeUndefined();
      expect(result.locations).toEqual([{ line: 1, column: 5 }]);
      expect(result.path).toEqual(["searchCampaignAssets"]);
    });

    test("Unit -> sanitizeGraphQLError preserves allowed error codes and messages", () => {
      const error: GraphQLFormattedError = {
        message: "Invalid input provided",
        extensions: {
          code: ApolloServerErrorCode.BAD_USER_INPUT,
          someInternalDetail: "database_id_12345",
        },
        locations: [{ line: 2, column: 10 }],
        path: ["updateCampaignAsset", "input"],
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.message).toBe("Invalid input provided");
      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.BAD_USER_INPUT
      );
      expect(result.extensions?.someInternalDetail).toBeUndefined();
      expect(result.locations).toEqual([{ line: 2, column: 10 }]);
      expect(result.path).toEqual(["updateCampaignAsset", "input"]);
    });

    test("Unit -> sanitizeGraphQLError converts unknown error codes to INTERNAL_SERVER_ERROR", () => {
      const error: GraphQLFormattedError = {
        message: "Database query failed",
        extensions: {
          code: "MONGODB_ERROR",
        },
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.message).toBe("An internal server error occurred");
      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.INTERNAL_SERVER_ERROR
      );
    });

    test("Unit -> sanitizeGraphQLError handles custom INACTIVE_USER error code", () => {
      const error: GraphQLFormattedError = {
        message: "Your account is inactive.",
        extensions: {
          code: "INACTIVE_USER",
        },
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.message).toBe("Your account is inactive.");
      expect(result.extensions?.code).toBe("INACTIVE_USER");
    });

    test("Unit -> sanitizeGraphQLError preserves all standard Apollo error codes", () => {
      const standardCodes = [
        ApolloServerErrorCode.GRAPHQL_PARSE_FAILED,
        ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED,
        ApolloServerErrorCode.BAD_USER_INPUT,
        ApolloServerErrorCode.BAD_REQUEST,
        ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND,
        ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED,
        ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE,
      ];

      for (const code of standardCodes) {
        const error: GraphQLFormattedError = {
          message: `Error with code ${code}`,
          extensions: { code },
        };

        const result = sanitizeGraphQLError(error, true);

        expect(result.extensions?.code).toBe(code);
        expect(result.message).toBe(`Error with code ${code}`);
      }
    });

    test("Unit -> sanitizeGraphQLError handles errors without extensions", () => {
      const error: GraphQLFormattedError = {
        message: "Unknown error occurred",
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.message).toBe("An internal server error occurred");
      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.INTERNAL_SERVER_ERROR
      );
    });

    test("Unit -> sanitizeGraphQLError removes stack traces from extensions", () => {
      const error: GraphQLFormattedError = {
        message: "Search failed",
        extensions: {
          code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
          stacktrace: [
            "Error: Search failed",
            "    at searchCampaignAssets (/app/src/search.ts:100:15)",
            "    at async /app/src/resolver.ts:50:20",
          ],
          originalError: {
            message: "MongoDB $rankFusion stage not supported",
            name: "MongoError",
          },
        },
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.extensions?.stacktrace).toBeUndefined();
      expect(result.extensions?.originalError).toBeUndefined();
      expect(Object.keys(result.extensions || {})).toEqual(["code"]);
    });
  });

  describe("Development mode", () => {
    test("Unit -> sanitizeGraphQLError preserves full error details in development", () => {
      const error: GraphQLFormattedError = {
        message: "MongoDB connection failed: authentication error",
        extensions: {
          code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
          stacktrace: ["Error at line 1", "at function foo"],
          exception: { code: "ERR_MONGO_AUTH" },
          debugInfo: { query: "db.collection.find({})" },
        },
        locations: [{ line: 1, column: 5 }],
        path: ["searchCampaignAssets"],
      };

      const result = sanitizeGraphQLError(error, false);

      expect(result.message).toBe(
        "MongoDB connection failed: authentication error"
      );
      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.INTERNAL_SERVER_ERROR
      );
      expect(result.extensions?.stacktrace).toEqual([
        "Error at line 1",
        "at function foo",
      ]);
      expect(result.extensions?.exception).toEqual({ code: "ERR_MONGO_AUTH" });
      expect(result.extensions?.debugInfo).toEqual({
        query: "db.collection.find({})",
      });
      expect(result.locations).toEqual([{ line: 1, column: 5 }]);
      expect(result.path).toEqual(["searchCampaignAssets"]);
    });

    test("Unit -> sanitizeGraphQLError converts unknown codes in development", () => {
      const error: GraphQLFormattedError = {
        message: "Database error",
        extensions: {
          code: "SOME_UNKNOWN_CODE",
          details: "helpful debugging info",
        },
      };

      const result = sanitizeGraphQLError(error, false);

      expect(result.message).toBe("Database error");
      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.INTERNAL_SERVER_ERROR
      );
      expect(result.extensions?.details).toBe("helpful debugging info");
    });

    test("Unit -> sanitizeGraphQLError preserves allowed codes in development", () => {
      const error: GraphQLFormattedError = {
        message: "Bad input",
        extensions: {
          code: ApolloServerErrorCode.BAD_USER_INPUT,
          validationErrors: ["field required", "invalid format"],
        },
      };

      const result = sanitizeGraphQLError(error, false);

      expect(result.extensions?.code).toBe(
        ApolloServerErrorCode.BAD_USER_INPUT
      );
      expect(result.extensions?.validationErrors).toEqual([
        "field required",
        "invalid format",
      ]);
    });
  });

  describe("Edge cases", () => {
    test("Unit -> sanitizeGraphQLError handles null/undefined values in extensions", () => {
      const error: GraphQLFormattedError = {
        message: "Error",
        extensions: {
          code: ApolloServerErrorCode.BAD_REQUEST,
          nullValue: null,
          undefinedValue: undefined,
        },
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.extensions?.code).toBe(ApolloServerErrorCode.BAD_REQUEST);
      expect(result.extensions?.nullValue).toBeUndefined();
      expect(result.extensions?.undefinedValue).toBeUndefined();
    });

    test("Unit -> sanitizeGraphQLError handles empty locations and path arrays", () => {
      const error: GraphQLFormattedError = {
        message: "Error",
        extensions: {
          code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
        },
        locations: [],
        path: [],
      };

      const result = sanitizeGraphQLError(error, true);

      expect(result.locations).toEqual([]);
      expect(result.path).toEqual([]);
    });
  });

  describe("ALLOWED_ERROR_CODES", () => {
    test("Unit -> ALLOWED_ERROR_CODES contains all standard Apollo error codes", () => {
      const expectedCodes = [
        ApolloServerErrorCode.GRAPHQL_PARSE_FAILED,
        ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED,
        ApolloServerErrorCode.BAD_USER_INPUT,
        ApolloServerErrorCode.BAD_REQUEST,
        ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
        ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND,
        ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED,
        ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE,
        "INACTIVE_USER",
      ];

      for (const code of expectedCodes) {
        expect(ALLOWED_ERROR_CODES.has(code)).toBe(true);
      }
    });

    test("Unit -> ALLOWED_ERROR_CODES has correct size", () => {
      expect(ALLOWED_ERROR_CODES.size).toBe(9);
    });
  });
});
