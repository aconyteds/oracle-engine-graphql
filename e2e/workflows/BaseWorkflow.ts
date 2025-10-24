import type { Server } from "http";
import type { BaseNode } from "../nodes/BaseNode";
import type { NodeResult } from "../nodes/NodeResult";
import { WorkflowContext } from "./WorkflowContext";

/**
 * Result of a workflow execution
 */
export type WorkflowResult = {
  /** Whether the entire workflow succeeded */
  success: boolean;
  /** ID of the node that failed (if any) */
  failedNode?: string;
  /** Error from the failed node (if any) */
  error?: string;
  /** Results from all executed nodes */
  nodeResults: Array<NodeResult<unknown>>;
  /** Final workflow context */
  context: WorkflowContext;
};

/**
 * Base class for all workflows.
 * A workflow is a sequence of nodes that execute in order.
 */
export abstract class BaseWorkflow {
  /** The GraphQL server instance */
  protected server: Server;

  /** Shared context for data passing between nodes */
  protected context: WorkflowContext;

  /** Authentication token (if authenticated workflow) */
  protected authToken?: string;

  /** Results from all executed nodes */
  protected nodeResults: Array<NodeResult<unknown>> = [];

  constructor(server: Server) {
    this.server = server;
    this.context = new WorkflowContext();
  }

  /**
   * Execute the workflow.
   * Subclasses must implement this to define their node sequence.
   */
  abstract execute(): Promise<WorkflowResult>;

  /**
   * Helper: Execute a single node and track the result
   */
  protected async executeNode<TInput, TOutput>(
    node: BaseNode<TInput, TOutput>,
    input: TInput
  ): Promise<NodeResult<TOutput>> {
    // Update node's auth token if we have one
    if (this.authToken) {
      node.setAuthToken(this.authToken);
    }

    // Execute the node
    const result = await node.execute(input);

    // Track the result
    this.nodeResults.push(result);

    return result;
  }

  /**
   * Helper: Create a success workflow result
   */
  protected createSuccessResult(): WorkflowResult {
    return {
      success: true,
      nodeResults: this.nodeResults,
      context: this.context,
    };
  }

  /**
   * Helper: Create a failure workflow result
   */
  protected createFailureResult(
    nodeId: string,
    errorMessage: string
  ): WorkflowResult {
    return {
      success: false,
      failedNode: nodeId,
      error: errorMessage,
      nodeResults: this.nodeResults,
      context: this.context,
    };
  }

  /**
   * Helper: Check if a node result succeeded, and handle failure
   */
  protected checkNodeSuccess<TOutput>(
    result: NodeResult<TOutput>
  ): WorkflowResult | null {
    if (!result.success) {
      const errorMessage =
        result.errors?.map((e) => e.message).join(", ") || "Unknown error";
      return this.createFailureResult(result.nodeId, errorMessage);
    }
    return null;
  }
}
