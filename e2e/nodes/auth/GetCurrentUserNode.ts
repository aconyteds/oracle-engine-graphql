import type { Server } from "http";
import { BaseNode } from "../BaseNode";
import type { NodeResult } from "../NodeResult";

/**
 * Output from GetCurrentUserNode
 */
export type GetCurrentUserOutput = {
  currentUser: {
    id: string;
    email: string | null;
    name: string | null;
    isActive: boolean;
  } | null;
};

/**
 * Node for getting the currently authenticated user.
 * Requires authentication token to be set.
 */
export class GetCurrentUserNode extends BaseNode<void, GetCurrentUserOutput> {
  readonly nodeId = "GetCurrentUserNode";

  constructor(server: Server, authToken?: string) {
    super(server, authToken);
  }

  async execute(): Promise<NodeResult<GetCurrentUserOutput>> {
    const query = `
      query GetCurrentUser {
        currentUser {
          id
          email
          name
          isActive
        }
      }
    `;

    const result = await this.executeGraphQL<GetCurrentUserOutput>(query);

    // Perform built-in assertions
    if (result.success) {
      this.expectSuccess(result);
      this.expectField(result, "currentUser");
    }

    return result;
  }
}
