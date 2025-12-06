// Message type for analysis
export interface AnalysisMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  createdAt: string;
  routingMetadata?: {
    decision: {
      targetAgent: string;
      confidence: number;
      reasoning: string;
      fallbackAgent?: string;
      intentKeywords: string[];
      contextFactors?: string[];
    } | null;
    executionTime: number;
    success: boolean;
    fallbackUsed: boolean;
  } | null;
}

// Analysis result types
export interface TopicShift {
  from: string;
  to: string;
  messageIndex: number;
  confidence: number;
}

export interface AgentPerformance {
  lastUsed: number; // messages ago
  successRate: number;
  avgResponseQuality: number;
  userSatisfaction: "positive" | "negative" | "neutral";
  overuseIndicator?: boolean;
  contextMismatch?: number;
}

export interface ConversationPattern {
  type:
    | "escalating_complexity"
    | "repeated_failures"
    | "session_flow"
    | "topic_drift"
    | "workflow_continuation";
  description: string;
  confidence: number;
  recommendation:
    | "route_to_specialist"
    | "try_different_agent"
    | "maintain_current_agent"
    | "escalate_to_human";
  failureCount?: number;
  currentStep?: string;
}

export interface ContinuityFactor {
  type:
    | "active_workflow"
    | "knowledge_buildup"
    | "user_preference"
    | "session_state";
  workflow?: string;
  completionPercentage?: number;
  contextValue?: "high" | "medium" | "low";
  description: string;
  recommendation:
    | "maintain_current_agent"
    | "prefer_current_agent"
    | "allow_agent_switch";
}

export interface ConversationAnalysis {
  analysisType: "conversation_context";
  messageCount: number;
  topicShifts: TopicShift[];
  dominantTopics: string[];
  topicStability: number;
  agentPerformance: Record<string, AgentPerformance>;
  patterns: ConversationPattern[];
  continuityFactors: ContinuityFactor[];
  recommendations: string[];
}
