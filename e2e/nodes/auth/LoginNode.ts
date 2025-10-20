import { expect } from "bun:test";
import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Input for LoginNode
 */
export type LoginInput = {
  email: string;
  password: string;
};

/**
 * Output from LoginNode
 */
export type LoginOutput = {
  login: {
    user: {
      id: string;
      email: string | null;
      name: string | null;
      isActive: boolean;
    } | null;
    token: string | null;
  } | null;
};

/**
 * Node for logging in a user.
 * Returns the user and authentication token.
 */
export class LoginNode extends BaseNode<LoginInput, LoginOutput> {
  readonly nodeId = "LoginNode";

  constructor(server: Server) {
    super(server);
  }

  async execute(input: LoginInput): Promise<NodeResult<LoginOutput>> {
    const query = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          user {
            id
            email
            name
            isActive
          }
          token
        }
      }
    `;

    const result = await this.executeGraphQL<LoginOutput>(query, { input });

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "login");

      // Verify login response has required fields
      const loginData = result.data?.login;
      expect(loginData).toBeDefined();
      expect(loginData?.token).toBeDefined();
      expect(loginData?.user).toBeDefined();
    }

    return result;
  }
}
