/**
 * Result type for node execution.
 * Nodes return this to indicate success/failure and provide data.
 */
export type NodeResult<TData = unknown> = {
  /** Whether the node execution was successful */
  success: boolean;
  /** Data returned by the node (only present on success) */
  data?: TData;
  /** Errors that occurred during execution */
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  /** Unique identifier for the node that produced this result */
  nodeId: string;
  /** Optional metadata about the execution */
  metadata?: Record<string, unknown>;
};

/**
 * Creates a successful NodeResult
 */
export function createSuccessResult<TData>(
  nodeId: string,
  data: TData,
  metadata?: Record<string, unknown>
): NodeResult<TData> {
  return {
    success: true,
    data,
    nodeId,
    metadata,
  };
}

/**
 * Creates a failed NodeResult
 */
export function createErrorResult(
  nodeId: string,
  errors: Array<{ message: string; extensions?: Record<string, unknown> }>,
  metadata?: Record<string, unknown>
): NodeResult<never> {
  return {
    success: false,
    errors,
    nodeId,
    metadata,
  };
}
