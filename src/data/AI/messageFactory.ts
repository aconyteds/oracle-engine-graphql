import type { GenerateMessagePayload } from "../../generated/graphql";
import { TranslateMessage } from "../../modules/utils";
import type { Message } from "../MongoDB";

/**
 * Centralized factory for creating typed message payloads.
 * All message creation flows through here for consistency.
 */
export class MessageFactory {
  static progress(content: string): GenerateMessagePayload {
    return {
      responseType: "Intermediate",
      content: `⚙️ ${content}`,
    };
  }

  static toolUsage(toolNames: string[]): GenerateMessagePayload {
    const friendlyNames = toolNames
      .map((name) => this.friendlyToolName(name))
      .join(", ");
    return {
      responseType: "Intermediate",
      content: `🛠️ ${friendlyNames}`,
    };
  }

  static routing(targetAgent: string): GenerateMessagePayload {
    const friendlyName = targetAgent.replace(/_/g, " ").replace("agent", "");
    return {
      responseType: "Intermediate",
      content: `🔀 Routing to ${friendlyName}...`,
    };
  }

  static assetCreated(
    assetType: "NPC" | "Location" | "Plot",
    assetId: string,
    assetName: string
  ): GenerateMessagePayload {
    const emoji = this.assetEmoji(assetType);
    return {
      responseType: "Intermediate",
      content: `${emoji} Created [${assetName}](${assetType}:${assetId})`,
    };
  }

  static assetUpdated(
    assetType: "NPC" | "Location" | "Plot",
    assetId: string,
    assetName: string
  ): GenerateMessagePayload {
    const emoji = this.assetEmoji(assetType);
    return {
      responseType: "Intermediate",
      content: `${emoji} Updated [${assetName}](${assetType}:${assetId})`,
    };
  }

  static assetDeleted(
    assetType: "NPC" | "Location" | "Plot",
    assetName: string
  ): GenerateMessagePayload {
    return {
      responseType: "Intermediate",
      content: `🗑️ Deleted ${assetType}: ${assetName}`,
    };
  }

  static searchResults(count: number, query: string): GenerateMessagePayload {
    if (count === 0) {
      return {
        responseType: "Intermediate",
        content: `🔍 No results found for "${query}"`,
      };
    }
    return {
      responseType: "Intermediate",
      content: `🔍 Found ${count} result${count === 1 ? "" : "s"} for "${query}"`,
    };
  }

  static final(message: Message): GenerateMessagePayload {
    return {
      responseType: "Final",
      content: message.content,
      message: TranslateMessage(message),
    };
  }

  static debug(content: string): GenerateMessagePayload {
    return {
      responseType: "Debug",
      content,
    };
  }

  static error(message: string): GenerateMessagePayload {
    return {
      responseType: "Intermediate",
      content: `❌ ${message}`,
    };
  }

  static reasoning(content: string): GenerateMessagePayload {
    return {
      responseType: "Reasoning",
      content: `🧠 ${content}`,
    };
  }

  static rateLimitWarning(
    usedCount: number,
    maxCount: number
  ): GenerateMessagePayload {
    const remaining = maxCount - usedCount;
    return {
      responseType: "Intermediate",
      content: `You have ${remaining} AI message${remaining === 1 ? "" : "s"} remaining today (${usedCount}/${maxCount} used)`,
    };
  }

  static rateLimitExceeded(maxCount: number): GenerateMessagePayload {
    return {
      responseType: "Intermediate",
      content: `Daily limit reached (${maxCount} messages). Your limit resets at midnight UTC. Consider upgrading your subscription for more messages.`,
    };
  }

  // Helper methods

  private static friendlyToolName(toolName: string): string {
    // tool names are snake_case, convert to Title Case
    return toolName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private static assetEmoji(assetType: string): string {
    const emojiMap: Record<string, string> = {
      NPC: "👤",
      Location: "📍",
      Plot: "📖",
    };
    return emojiMap[assetType] || "✨";
  }
}
