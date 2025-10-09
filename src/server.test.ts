import { test, expect, describe } from "bun:test";

import graphqlServer from "./server";

describe("GraphQL Server", () => {
  test("Unit -> server", async () => {
    const { app, httpServer, apolloServer } = await graphqlServer();
    expect(app).toBeDefined();
    expect(httpServer).toBeDefined();
    expect(apolloServer).toBeDefined();
  });
});
