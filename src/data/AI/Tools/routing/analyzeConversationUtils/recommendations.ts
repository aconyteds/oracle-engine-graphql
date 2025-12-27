import type { ConversationAnalysis } from "./types";

/**
 * Generates routing recommendations based on conversation analysis.
 */
export function generateRecommendations(
  analysis: ConversationAnalysis
): string[] {
  const recommendations: string[] = [];

  // Topic stability recommendations
  if (analysis.topicStability < 0.3) {
    recommendations.push(
      "Consider using a generalist agent due to topic instability"
    );
  } else if (
    analysis.topicStability > 0.8 &&
    analysis.dominantTopics.length > 0
  ) {
    recommendations.push(
      `Maintain focus on ${analysis.dominantTopics[0]} with specialized agent`
    );
  }

  // Agent performance recommendations
  Object.entries(analysis.agentPerformance).forEach(([agent, perf]) => {
    if (perf.overuseIndicator) {
      recommendations.push(
        `Consider diversifying from ${agent} to prevent overuse`
      );
    }
    if (perf.successRate < 0.5) {
      recommendations.push(
        `${agent} showing low success rate, consider alternatives`
      );
    }
    if (perf.userSatisfaction === "negative") {
      recommendations.push(
        `User dissatisfaction detected with ${agent}, try different approach`
      );
    }
  });

  // Pattern-based recommendations
  analysis.patterns.forEach((pattern) => {
    recommendations.push(
      `${pattern.type}: ${pattern.description} - ${pattern.recommendation}`
    );
  });

  // Continuity recommendations
  analysis.continuityFactors.forEach((factor) => {
    recommendations.push(
      `${factor.type}: ${factor.description} - ${factor.recommendation}`
    );
  });

  return recommendations.length > 0
    ? recommendations
    : ["Continue with current routing approach"];
}
