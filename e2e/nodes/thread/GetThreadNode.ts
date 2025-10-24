import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for GetThreadNode
 */
export type GetThreadInput = {
  threadId: string;
  campaignId: string; // For x-selected-campaign-id header
};

/**
 * Output from GetThreadNode
 */
export type GetThreadOutput = {
  getThread: {
    thread: {
      id: string;
      title: string;
      lastUsed: string;
      campaignId: string;
      messages: Array<{
        id: string;
        threadId: string;
        content: string;
        createdAt: string;
        role: string;
        tokenCount: number;
      }>;
    } | null;
  } | null;
};

/**
 * Node for getting a thread by ID.
 * Requires authentication and campaign selection.
 */
export class GetThreadNode extends BaseNode<GetThreadInput, GetThreadOutput> {
  readonly nodeId = "GetThreadNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(input: GetThreadInput): Promise<NodeResult<GetThreadOutput>> {
    const { threadId, campaignId } = input;

    const query = `
      query GetThread($input: GetThreadInput!) {
        getThread(input: $input) {
          thread {
            id
            title
            lastUsed
            campaignId
            messages {
              id
              threadId
              content
              createdAt
              role
              tokenCount
            }
          }
        }
      }
    `;

    // Execute GraphQL with campaign header
    const result = await this.executeGraphQLWithCampaign<GetThreadOutput>(
      query,
      { input: { threadId } },
      campaignId
    );

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "getThread");

      // Verify thread was retrieved
      const threadData = result.data?.getThread?.thread;
      expect(threadData).toBeDefined();
      expect(threadData?.id).toBe(threadId);
      expect(threadData?.campaignId).toBe(campaignId);
    }

    return result;
  }

  /**
   * Helper to execute GraphQL with campaign header
   */
  private async executeGraphQLWithCampaign<TData = unknown>(
    query: string,
    variables: Record<string, unknown>,
    campaignId: string
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

      // Add campaign selection header
      req.set("x-selected-campaign-id", campaignId);

      const response = await req;

      const body = response.body as {
        data?: TData;
        errors?: Array<{
          message: string;
          extensions?: Record<string, unknown>;
        }>;
      };

      const { createErrorResult, createSuccessResult } = await import(
        "../NodeResult"
      );

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
      const { createErrorResult } = await import("../NodeResult");
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
}
