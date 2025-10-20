import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "http";
import request from "supertest";

import { setupTestServer, teardownTestServer } from "./setup";

describe("E2E -> GraphQL Health Check", () => {
  let server: Server;

  beforeAll(async () => {
    server = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer(server);
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

    const body = response.body as {
      errors?: unknown;
      data: { healthCheck: boolean };
    };
    expect(body.errors).toBeUndefined();
    expect(body.data.healthCheck).toBe(true);
  });
});
