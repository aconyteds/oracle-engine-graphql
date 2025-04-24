import type { Request, Response } from "express";
import { streamManager } from "../data/AI/streamManager";
import { generateMessage } from "../modules/AI/service";

export async function generateThreadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { threadId } = req.params;

  if (!threadId) {
    res.status(400).send("Thread ID is required");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const existingStream = streamManager.getStream(threadId);
  if (!existingStream) {
    // exit because this is not where a stream is started
    res.status(404).send("Stream not found");
    return;
  }

  try {
    // Start generating the message
    for await (const chunk of generateMessage(threadId)) {
      if (!streamManager.isGenerating(threadId)) {
        break; // Stop if the stream was manually stopped
      }

      // Add the chunk to the stream manager
      streamManager.appendToStream(
        threadId,
        chunk.content || "",
        chunk.responseType === "Final" ? "text" : "tool-response"
      );

      // Send the chunk to the client
      const eventData = JSON.stringify(chunk);
      res.write(`event: message\ndata: ${eventData}\n\n`);
    }
  } catch (error) {
    // Send error to client
    const errorPayload = {
      responseType: "Error",
      content: error || "An unknown error occurred",
      error: true,
    };
    const errorEvent = JSON.stringify(errorPayload);
    res.write(`event: error\ndata: ${errorEvent}\n\n`);
  } finally {
    // Send end event before closing
    const endPayload = {
      responseType: "End",
      content: "Stream ended",
    };
    res.write(`event: complete\ndata: ${JSON.stringify(endPayload)}\n\n`);
    // Clean up the stream
    streamManager.cleanStream(threadId);
    res.end();
  }

  // Handle client disconnect
  req.on("close", () => {
    streamManager.stopStream(threadId);
    streamManager.cleanStream(threadId);
  });
}
