import type { RouterGraphState } from "../Workflows/routerWorkflow";

export function validateRouting(
  state: typeof RouterGraphState.State
): Promise<typeof RouterGraphState.State> {
  // Simple validation - check if we have a successful response
  const hasValidResponse = !!(
    state.currentResponse && state.currentResponse.length > 0
  );

  // Only mark as successful if we have a response AND the execution was successful
  const isSuccessful =
    hasValidResponse && state.routingMetadata?.success !== false;

  return Promise.resolve({
    ...state,
    routingMetadata: {
      ...state.routingMetadata!,
      success: isSuccessful,
    },
  });
}
