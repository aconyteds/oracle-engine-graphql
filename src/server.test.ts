import { test, expect } from "bun:test";

import graphqlServer from "./server";

test("Unit -> server", async () => {
  const { app, httpServer, apolloServer } = await graphqlServer();
  expect(app).toBeDefined();
  expect(httpServer).toBeDefined();
  expect(apolloServer).toBeDefined();
});
