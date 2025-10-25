import { testDatabase, testPrismaClient } from "./infrastructure";

/**
 * Global teardown for E2E tests.
 * This runs ONCE after all E2E tests have completed.
 * Cleans up shared MongoDB testcontainer and Prisma client.
 */
export default async function globalTeardown(): Promise<void> {
  try {
    console.log("Running global E2E teardown...");

    // 1. Disconnect Prisma client if still connected
    if (testPrismaClient.isInitialized()) {
      await testPrismaClient.disconnect();
    }

    // 2. Stop MongoDB testcontainer if still running
    if (testDatabase.isRunning()) {
      await testDatabase.stop();
    }

    console.log("Global E2E teardown complete");
  } catch (error) {
    console.error("Failed to run global E2E teardown:", error);
    throw error;
  }
}
