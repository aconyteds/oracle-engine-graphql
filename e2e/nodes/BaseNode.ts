import { expect } from "bun:test";
import type { Server } from "http";
import type { SuperTest, Test } from "supertest";
import request from "supertest";
import type { NodeResult } from "./NodeResult";
import { createErrorResult, createSuccessResult } from "./NodeResult";

/**
 * Base class for all workflow nodes.
 * Each node represents a single GraphQL operation with built-in assertions.
 */
export abstract class BaseNode<TInput = void, TOutput = unknown> {
  /** Unique identifier for this node */
  abstract readonly nodeId: string;

  /** The GraphQL server instance */
  protected server: Server;

  /** Supertest request instance */
  protected request: SuperTest<Test>;

  /** Optional auth token for authenticated requests */
  protected authToken?: string;

  constructor(server: Server, authToken?: string) {
    this.server = server;
    this.request = request(server);
    this.authToken = authToken;
  }

  /**
   * Execute the node's GraphQL operation
   */
  abstract execute(input: TInput): Promise<NodeResult<TOutput>>;

  /**
   * Set the authentication token for this node
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Helper: Execute a GraphQL query/mutation
   */
  protected async executeGraphQL<TData = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<NodeResult<TData>> {
    try {
      const req = this.request.post("/graphql").send({
        query,
        variables,
      });

      // Add auth header if token is present
      if (this.authToken) {
        req.set("Authorization", `Bearer ${this.authToken}`);
      }

      const response = await req;

      const body = response.body as {
        data?: TData;
        errors?: Array<{
          message: string;
          extensions?: Record<string, unknown>;
        }>;
      };

      // Check for GraphQL errors
      if (body.errors && body.errors.length > 0) {
        return createErrorResult(this.nodeId, body.errors, {
          statusCode: response.status,
        });
      }

      // Check for HTTP errors
      if (response.status !== 200) {
        return createErrorResult(
          this.nodeId,
          [
            {
              message: `HTTP ${response.status}: ${response.statusText || "Unknown error"}`,
            },
          ],
          { statusCode: response.status }
        );
      }

      return createSuccessResult(this.nodeId, body.data as TData, {
        statusCode: response.status,
      });
    } catch (error) {
      return createErrorResult(
        this.nodeId,
        [
          {
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ],
        { error }
      );
    }
  }

  /**
   * Built-in assertion: Verify the node executed successfully
   */
  protected expectSuccess(result: NodeResult<TOutput>): void {
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();
  }

  /**
   * Built-in assertion: Verify a specific field exists in the result
   */
  protected expectField<K extends keyof TOutput>(
    result: NodeResult<TOutput>,
    field: K
  ): void {
    expect(result.data).toBeDefined();
    expect(result.data?.[field]).toBeDefined();
  }

  /**
   * Built-in assertion: Verify a specific field has an expected value
   */
  protected expectFieldValue<K extends keyof TOutput>(
    result: NodeResult<TOutput>,
    field: K,
    value: TOutput[K]
  ): void {
    expect(result.data).toBeDefined();
    expect(result.data?.[field]).toEqual(value);
  }

  /**
   * Built-in assertion: Verify the node failed with an error
   */
  protected expectError(result: NodeResult<TOutput>): void {
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  }

  /**
   * Built-in assertion: Verify the node failed with a specific error message
   */
  protected expectErrorMessage(
    result: NodeResult<TOutput>,
    messagePattern: string | RegExp
  ): void {
    this.expectError(result);
    const errorMessage = result.errors?.[0]?.message || "";
    if (typeof messagePattern === "string") {
      expect(errorMessage).toContain(messagePattern);
    } else {
      expect(errorMessage).toMatch(messagePattern);
    }
  }
}
