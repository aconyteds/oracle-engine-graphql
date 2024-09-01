import { Server } from "http";
import GraphQLServer from "../src/server"; // Adjust the path as necessary

export const setupTestServer = async (): Promise<Server> => {
  const path = "/graphql";
  const { httpServer } = await GraphQLServer(path);
  return httpServer.listen(0); // Listen on an ephemeral port for testing
};

export const teardownTestServer = (server: Server): void => {
  server.close();
};
