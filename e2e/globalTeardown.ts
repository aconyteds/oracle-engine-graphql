import { logger } from "../src/utils/logger";
import { testDatabase, testPrismaClient } from "./infrastructure";

/**
 * Global teardown for E2E tests.
 * This runs ONCE after all E2E tests have completed.
 * Cleans up shared MongoDB testcontainer and Prisma client.
 */
export default async function globalTeardown(): Promise<void> {
  try {
    logger.info("Running global E2E teardown...");

    // 1. Disconnect Prisma client if still connected
    if (testPrismaClient.isInitialized()) {
      await testPrismaClient.disconnect();
    }

    // 2. Stop MongoDB testcontainer if still running
    if (testDatabase.isRunning()) {
      await testDatabase.stop();
    }

    logger.success("Global E2E teardown complete");
  } catch (error) {
    logger.error("Failed to run global E2E teardown:", error);
    throw error;
  }
}
