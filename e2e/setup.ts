import type { Server } from "http";
import GraphQLServer from "../src/server";
import { logger } from "../src/utils/logger";
import { sharedTestEnvironment, testPrismaClient } from "./infrastructure";

/**
 * Setup a GraphQL server instance for a test file.
 * Note: MongoDB testcontainer is shared globally and DATABASE_URL is set by sharedTestEnvironment
 */
export const setupTestServer = async (): Promise<Server> => {
  try {
    logger.info("Setting up test server...");

    // Clean database before each test file
    await testPrismaClient.cleanup();

    // Start GraphQL server
    // Note: DATABASE_URL is already set to test database by sharedTestEnvironment
    const path = "/graphql";
    const { httpServer } = await GraphQLServer(path);

    // Listen on an ephemeral port for testing
    const server = httpServer.listen(0);

    logger.success("Test server ready");

    return server;
  } catch (error) {
    logger.error("Failed to setup test server:", error);
    throw error;
  }
};

/**
 * Teardown a GraphQL server instance after a test file.
 * Note: MongoDB testcontainer cleanup happens globally (see globalTeardown.ts)
 */
export const teardownTestServer = async (server: Server): Promise<void> => {
  try {
    logger.info("Tearing down test server...");

    // Close server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    logger.success("Test server torn down");
  } catch (error) {
    logger.error("Failed to teardown test server:", error);
    throw error;
  }
};
