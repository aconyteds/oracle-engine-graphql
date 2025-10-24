import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from "@testcontainers/mongodb";
import { logger } from "../../src/utils/logger";

class TestDatabase {
  private static instance: TestDatabase;
  private container: StartedMongoDBContainer | null = null;
  private connectionString: string | null = null;

  private constructor() {}

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async start(): Promise<string> {
    if (this.container && this.connectionString) {
      logger.info("Test MongoDB container already running");
      return this.connectionString;
    }

    try {
      logger.info("Starting MongoDB testcontainer...");

      // Start MongoDB container with latest version
      this.container = await new MongoDBContainer("mongo:7.0")
        .withReuse()
        .start();

      // Get connection string and add database name for Prisma
      const baseConnectionString = this.container.getConnectionString();
      // Ensure proper formatting: mongodb://host:port/database?options
      this.connectionString = baseConnectionString.endsWith("/")
        ? `${baseConnectionString}test?directConnection=true`
        : `${baseConnectionString}/test?directConnection=true`;

      logger.success(`MongoDB testcontainer started: ${this.connectionString}`);

      return this.connectionString;
    } catch (error) {
      logger.error("Failed to start MongoDB testcontainer:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.container) {
      logger.info("No test MongoDB container to stop");
      return;
    }

    try {
      logger.info("Stopping MongoDB testcontainer...");
      await this.container.stop();
      this.container = null;
      this.connectionString = null;
      logger.success("MongoDB testcontainer stopped");
    } catch (error) {
      logger.error("Failed to stop MongoDB testcontainer:", error);
      throw error;
    }
  }

  getConnectionString(): string {
    if (!this.connectionString) {
      throw new Error("MongoDB testcontainer not started. Call start() first.");
    }
    return this.connectionString;
  }

  isRunning(): boolean {
    return this.container !== null && this.connectionString !== null;
  }
}

export const testDatabase = TestDatabase.getInstance();
