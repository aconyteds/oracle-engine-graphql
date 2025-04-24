interface StreamPart {
  type: "text" | "tool-invocation" | "tool-response";
  content: string;
}

interface Stream {
  threadId: string;
  isGenerating: boolean;
  parts: StreamPart[];
  activePart?: StreamPart;
}

class StreamManager {
  private activeStreams: Map<string, Stream>;

  constructor() {
    this.activeStreams = new Map();
  }

  public addStream(threadId: string): void {
    if (this.activeStreams.has(threadId)) {
      throw new Error(`Stream already exists for thread ${threadId}`);
    }

    this.activeStreams.set(threadId, {
      threadId,
      isGenerating: true,
      parts: [],
    });
  }

  public getStream(threadId: string): Stream | undefined {
    return this.activeStreams.get(threadId);
  }

  public stopStream(threadId: string): void {
    const stream = this.activeStreams.get(threadId);
    if (stream) {
      stream.isGenerating = false;
    }
  }

  public createStreamPart(
    threadId: string,
    type: StreamPart["type"] = "text"
  ): void {
    const stream = this.activeStreams.get(threadId);
    if (!stream) {
      throw new Error(`No stream found for thread ${threadId}`);
    }

    if (!stream.isGenerating) {
      throw new Error(`Stream ${threadId} is no longer generating`);
    }

    // If there's an active part, push it to parts before creating new one
    if (stream.activePart) {
      stream.parts.push(stream.activePart);
    }

    // Create new active part
    stream.activePart = {
      type,
      content: "",
    };
  }

  public appendToStream(
    threadId: string,
    content: string,
    type: StreamPart["type"] = "text"
  ): void {
    const stream = this.activeStreams.get(threadId);
    if (!stream) {
      throw new Error(`No stream found for thread ${threadId}`);
    }

    if (!stream.isGenerating) {
      throw new Error(`Stream ${threadId} is no longer generating`);
    }

    // If no active part exists or type is different, create new part
    if (!stream.activePart || stream.activePart.type !== type) {
      this.createStreamPart(threadId, type);
    }

    // Append content to active part
    if (stream.activePart) {
      stream.activePart.content += content;
    }
  }

  public cleanStream(threadId: string): void {
    const stream = this.activeStreams.get(threadId);
    if (!stream) {
      return;
    }
    this.activeStreams.delete(threadId);
  }

  public isGenerating(threadId: string): boolean {
    const stream = this.activeStreams.get(threadId);
    return stream?.isGenerating ?? false;
  }
}

// Export a singleton instance
export const streamManager = new StreamManager();
