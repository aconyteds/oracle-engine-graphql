import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for CaptureHumanFeedbackNode
 */
export type CaptureHumanFeedbackInput = {
  messageId: string;
  humanSentiment: boolean;
  comments?: string;
  campaignId: string; // For x-selected-campaign-id header
};

/**
 * Output from CaptureHumanFeedbackNode
 */
export type CaptureHumanFeedbackOutput = {
  captureHumanFeedback: {
    message: string;
  } | null;
};

/**
 * Node for capturing human feedback on AI-generated messages.
 * Requires authentication and campaign selection.
 */
export class CaptureHumanFeedbackNode extends BaseNode<
  CaptureHumanFeedbackInput,
  CaptureHumanFeedbackOutput
> {
  readonly nodeId = "CaptureHumanFeedbackNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(
    input: CaptureHumanFeedbackInput
  ): Promise<NodeResult<CaptureHumanFeedbackOutput>> {
    const { messageId, humanSentiment, comments, campaignId } = input;

    const query = `
      mutation CaptureHumanFeedback($input: CaptureHumanFeedbackInput!) {
        captureHumanFeedback(input: $input) {
          message
        }
      }
    `;

    // Build the mutation input
    const mutationInput: {
      messageId: string;
      humanSentiment: boolean;
      comments?: string;
    } = {
      messageId,
      humanSentiment,
    };

    // Only include comments if provided
    if (comments !== undefined) {
      mutationInput.comments = comments;
    }

    // Execute GraphQL with campaign header
    const result =
      await this.executeGraphQLWithCampaign<CaptureHumanFeedbackOutput>(
        query,
        { input: mutationInput },
        campaignId
      );

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "captureHumanFeedback");

      // Verify feedback was captured
      const feedbackData = result.data?.captureHumanFeedback;
      expect(feedbackData).toBeDefined();
      expect(feedbackData?.message).toBe("Thank you for providing feedback!");
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
              message: `HTTP ${response.status}`,
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
