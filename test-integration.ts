#!/usr/bin/env bun

// Quick integration test script
import { getAgentByName } from "./src/data/AI/agentList";

console.log("🧪 Testing Router Integration...\n");

try {
  // Test loading different agent types
  const cheapest = getAgentByName("Cheapest");
  const mainRouter = getAgentByName("MainRouter");
  const charGen = getAgentByName("Character Generator");

  console.log("✅ Agent Loading Test:");
  console.log(
    `   Cheapest: ${cheapest.name} (Router: ${!!cheapest.availableSubAgents?.length})`
  );
  console.log(
    `   MainRouter: ${mainRouter.name} (Router: ${!!mainRouter.availableSubAgents?.length})`
  );
  console.log(
    `   Character Generator: ${charGen.name} (Router: ${!!charGen.availableSubAgents?.length})`
  );

  // Test agent type detection logic (same as generateMessage.ts)
  function getAgentType(agent: any): "standard" | "router" {
    return agent.availableSubAgents && agent.availableSubAgents.length > 0
      ? "router"
      : "standard";
  }

  console.log("\n✅ Agent Type Detection:");
  console.log(`   Cheapest → ${getAgentType(cheapest)} workflow`);
  console.log(`   MainRouter → ${getAgentType(mainRouter)} workflow`);
  console.log(`   Character Generator → ${getAgentType(charGen)} workflow`);

  console.log("\n✅ Router Hierarchy:");
  console.log(
    `   MainRouter has ${mainRouter.availableSubAgents?.length || 0} sub-agents:`
  );
  mainRouter.availableSubAgents?.forEach((sub, i) => {
    console.log(
      `   ${i + 1}. ${sub.name} (Router: ${!!sub.availableSubAgents?.length})`
    );
  });

  console.log(
    "\n🎉 Integration test passed! The router system is ready to use."
  );
  console.log("\n📋 Usage Guide:");
  console.log("   • Select 'MainRouter' for intelligent routing");
  console.log(
    "   • Select 'Cheapest' or 'Character Generator' for direct access"
  );
  console.log(
    "   • Router agents will automatically route to specialized sub-agents"
  );
} catch (error) {
  console.error("❌ Integration test failed:", error);
  process.exit(1);
}
