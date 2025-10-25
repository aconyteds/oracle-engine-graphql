import { testDatabase, testPrismaClient } from "./infrastructure";

/**
 * Global setup for E2E tests.
 * This runs ONCE before all E2E tests.
 * Sets up shared MongoDB testcontainer and Prisma client.
 */
export default async function globalSetup(): Promise<void> {
  try {
    console.log("Running global E2E setup...");

    // 1. Start MongoDB testcontainer (shared across all tests)
    await testDatabase.start();

    // 2. Initialize Prisma client with test database
    await testPrismaClient.initialize();

    // 3. Push Prisma schema to test database
    await testPrismaClient.pushSchema();

    console.log("Global E2E setup complete - MongoDB testcontainer ready");
  } catch (error) {
    console.error("Failed to run global E2E setup:", error);
    throw error;
  }
}
