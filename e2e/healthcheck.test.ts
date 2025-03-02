import request from "supertest";
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import type { Server } from "http";

import { setupTestServer, teardownTestServer } from "./setup";

describe("E2E -> GraphQL Health Check", () => {
  let server: Server;
  beforeAll(async () => {
    server = await setupTestServer();
  });

  afterAll(() => {
    teardownTestServer(server);
  });

  test("healthCheck query returns true", async () => {
    const response = await request(server)
      .post("/graphql")
      .send({
        query: `
          query {
            healthCheck
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.healthCheck).toBe(true);
  });
});
