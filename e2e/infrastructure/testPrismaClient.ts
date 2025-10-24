import { PrismaClient } from "@prisma/client";
import { logger } from "../../src/utils/logger";
import { testDatabase } from "./testDatabase";

class TestPrismaClient {
  private static instance: TestPrismaClient;
  private client: PrismaClient | null = null;

  private constructor() {}

  static getInstance(): TestPrismaClient {
    if (!TestPrismaClient.instance) {
      TestPrismaClient.instance = new TestPrismaClient();
    }
    return TestPrismaClient.instance;
  }

  async initialize(): Promise<PrismaClient> {
    if (this.client) {
      logger.info("Test Prisma client already initialized");
      return this.client;
    }

    try {
      const connectionString = testDatabase.getConnectionString();

      logger.info("Initializing test Prisma client...");

      // Create Prisma client with test database connection
      this.client = new PrismaClient({
        datasources: {
          db: {
            url: connectionString,
          },
        },
      });

      // Connect to database
      await this.client.$connect();

      logger.success("Test Prisma client initialized and connected");

      return this.client;
    } catch (error) {
      logger.error("Failed to initialize test Prisma client:", error);
      throw error;
    }
  }

  async pushSchema(): Promise<void> {
    if (!this.client) {
      throw new Error(
        "Test Prisma client not initialized. Call initialize() first."
      );
    }

    try {
      logger.info("Pushing Prisma schema to test database...");

      // Execute prisma db push programmatically
      const { execSync } = await import("child_process");
      const connectionString = testDatabase.getConnectionString();

      execSync("bunx prisma db push --skip-generate", {
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
        },
        stdio: "inherit",
      });

      logger.success("Prisma schema pushed to test database");
    } catch (error) {
      logger.error("Failed to push Prisma schema:", error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.client) {
      logger.info("No test Prisma client to cleanup");
      return;
    }

    try {
      logger.info("Cleaning up test Prisma client...");

      // Clear all collections
      const collections = ["user", "thread", "message", "campaign"];

      for (const collection of collections) {
        try {
          // @ts-expect-error - Dynamic access to Prisma models
          await this.client[collection].deleteMany({});
        } catch (error) {
          // Collection might not exist yet, that's okay
          logger.warn(`Skipped cleanup for ${collection}:`, error);
        }
      }

      logger.success("Test database cleaned up");
    } catch (error) {
      logger.error("Failed to cleanup test database:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      logger.info("No test Prisma client to disconnect");
      return;
    }

    try {
      logger.info("Disconnecting test Prisma client...");
      await this.client.$disconnect();
      this.client = null;
      logger.success("Test Prisma client disconnected");
    } catch (error) {
      logger.error("Failed to disconnect test Prisma client:", error);
      throw error;
    }
  }

  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error(
        "Test Prisma client not initialized. Call initialize() first."
      );
    }
    return this.client;
  }

  isInitialized(): boolean {
    return this.client !== null;
  }
}

export const testPrismaClient = TestPrismaClient.getInstance();
