import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for CreateMessageNode
 */
export type CreateMessageInput = {
  threadId?: string;
  content: string;
  campaignId: string; // For x-selected-campaign-id header
};

/**
 * Output from CreateMessageNode
 */
export type CreateMessageOutput = {
  createMessage: {
    threadId: string;
    message: {
      id: string;
      threadId: string;
      content: string;
      createdAt: string;
      role: string;
      tokenCount: number;
    };
  } | null;
};

/**
 * Node for creating a new message.
 * Can create a message in an existing thread or create a new thread.
 * Requires authentication and campaign selection.
 */
export class CreateMessageNode extends BaseNode<
  CreateMessageInput,
  CreateMessageOutput
> {
  readonly nodeId = "CreateMessageNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: CreateMessageInput
  ): Promise<NodeResult<CreateMessageOutput>> {
    const { threadId, content, campaignId } = input;

    const query = `
      mutation CreateMessage($input: CreateMessageInput!) {
        createMessage(input: $input) {
          threadId
          message {
            id
            threadId
            content
            createdAt
            role
            tokenCount
          }
        }
      }
    `;

    // Build the mutation input
    const mutationInput: { threadId?: string; content: string } = { content };
    if (threadId) {
      mutationInput.threadId = threadId;
    }

    // Execute GraphQL with campaign header
    const result = await this.executeGraphQLWithCampaign<CreateMessageOutput>(
      query,
      { input: mutationInput },
      campaignId
    );

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "createMessage");

      // Verify message was created
      const messageData = result.data?.createMessage;
      expect(messageData).toBeDefined();
      expect(messageData?.threadId).toBeDefined();
      expect(messageData?.message).toBeDefined();
      expect(messageData?.message.content).toBe(content);
      expect(messageData?.message.role).toBe("User");
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
