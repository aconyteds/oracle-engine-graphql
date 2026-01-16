import { ENV } from "../../config/environment";
import { DBClient } from "../MongoDB";
import { LangSmithClient } from "./client";

export async function getTraceId(messageId: string): Promise<string | null> {
  try {
    const message = await DBClient.message.findUnique({
      where: { id: messageId },
    });
    if (!message || !message.runId) {
      console.info(
        `No runId found for message ID: ${messageId}. Cannot fetch trace ID. This likely means this message was not AI generated.`
      );
      return null;
    }
    if (message.langSmithTraceId) {
      // We already fetched it, yay!
      return message.langSmithTraceId;
    }
    const runId = message.runId;
    const runs = await LangSmithClient.listRuns({
      projectName: ENV.LANGSMITH_PROJECT,
      filter: `has(metadata, '{"runId": "${runId}"}')`,
      // We only want the first run that matches
      // This should be the latest run
      limit: 1,
    });
    let traceId: string | null | undefined = null;
    for await (const run of runs) {
      // Fetch the trace ID from the run
      traceId = run.trace_id;
      break;
    }
    if (!traceId) {
      console.info(
        `No trace ID found for runId: ${runId}. This likely means the run was not sampled.`
      );
      return null;
    }

    // Update the message with the fetched trace ID for future use
    await DBClient.message.update({
      where: { id: messageId },
      data: { langSmithTraceId: traceId },
    });

    return traceId;
  } catch (error) {
    console.warn(`Error fetching trace ID for message ID: ${messageId}`, error);
    return null;
  }
}
