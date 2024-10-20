import { rule, shield, allow } from "graphql-shield";

import type { Context } from "../serverContext";

// Rule to check if user is authenticated
const isAuthenticated = rule({ cache: "contextual" })(async (
  parent,
  args,
  context: Context
) => {
  return !!context.userId;
});

export const permissions = shield(
  {
    Query: {
      // All queries require authentication by default
      "*": isAuthenticated,
      // Public queries
      healthCheck: allow,
    },
    Mutation: {
      // All mutations require authentication by default
      "*": isAuthenticated,
      // Public mutations
      login: allow,
    },
    Subscription: {
      "*": isAuthenticated,
    },
    // Allow all fields in LoginPayload to be accessed by anyone, needed for login
    LoginPayload: allow,
  },
  {
    // If an operation is not specified, deny access
    fallbackRule: isAuthenticated,
    // Allow external errors (e.g., from resolvers) to pass through
    allowExternalErrors: true,
  }
);
