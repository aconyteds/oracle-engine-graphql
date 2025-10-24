import { logger } from "../../src/utils/logger";
import { testDatabase } from "./testDatabase";
import { testPrismaClient } from "./testPrismaClient";

/**
 * Shared test environment that initializes once and is reused across all E2E tests.
 * This ensures we only create one MongoDB testcontainer for the entire test suite.
 */
class SharedTestEnvironment {
  private static instance: SharedTestEnvironment;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SharedTestEnvironment {
    if (!SharedTestEnvironment.instance) {
      SharedTestEnvironment.instance = new SharedTestEnvironment();
    }
    return SharedTestEnvironment.instance;
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      logger.info("Test environment already initialized");
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      logger.info("Test environment initialization in progress, waiting...");
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = this.doInitialize();
    await this.initPromise;
    this.initialized = true;
    this.initPromise = null;
  }

  private async doInitialize(): Promise<void> {
    try {
      logger.info("Initializing shared test environment...");

      // 1. Start MongoDB testcontainer (shared across all tests)
      const connectionString = await testDatabase.start();

      // 2. Override DATABASE_URL environment variable for all subsequent Prisma client instantiations
      // This ensures that any DBClient instances created during tests will connect to the test database
      process.env.DATABASE_URL = connectionString;
      logger.info(`Set DATABASE_URL to test database for E2E tests`);

      // 3. Initialize Prisma client with test database
      await testPrismaClient.initialize();

      // 4. Push Prisma schema to test database
      await testPrismaClient.pushSchema();

      logger.success("Shared test environment initialized");
    } catch (error) {
      logger.error("Failed to initialize shared test environment:", error);
      this.initialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      logger.info("Test environment not initialized, nothing to cleanup");
      return;
    }

    try {
      logger.info("Cleaning up shared test environment...");

      // 1. Disconnect Prisma client
      if (testPrismaClient.isInitialized()) {
        await testPrismaClient.disconnect();
      }

      // 2. Stop MongoDB testcontainer
      if (testDatabase.isRunning()) {
        await testDatabase.stop();
      }

      this.initialized = false;
      logger.success("Shared test environment cleaned up");
    } catch (error) {
      logger.error("Failed to cleanup shared test environment:", error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConnectionString(): string {
    return testDatabase.getConnectionString();
  }
}

export const sharedTestEnvironment = SharedTestEnvironment.getInstance();

// Only initialize if we're running E2E tests (not unit tests)
// Check if the test command includes 'e2e' directory
const isE2ETest = process.argv.some((arg) => arg.includes("e2e"));

if (isE2ETest) {
  // Initialize on module load
  await sharedTestEnvironment.initialize();

  // Cleanup on process exit
  process.on("beforeExit", async () => {
    await sharedTestEnvironment.cleanup();
  });

  process.on("SIGINT", async () => {
    await sharedTestEnvironment.cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await sharedTestEnvironment.cleanup();
    process.exit(0);
  });
}
