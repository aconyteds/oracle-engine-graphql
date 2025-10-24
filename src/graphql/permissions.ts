import { allow, rule, shield } from "graphql-shield";

import { verifyCampaignOwnership } from "../data/MongoDB";
import type { ServerContext } from "../serverContext";

// Rule to check if user is authenticated
const isAuthenticated = rule({ cache: "contextual" })(
  (_parent, _args, context: ServerContext) => {
    return !!context.user;
  }
);

// Rule to check if campaign is selected and user has access to it
const hasCampaignSelected = rule({ cache: "contextual" })(
  async (_parent, _args, context: ServerContext) => {
    if (!context.selectedCampaignId) {
      return new Error(
        "Campaign selection required. Please provide x-selected-campaign-id header."
      );
    }
    if (!context.user) {
      return false;
    }
    try {
      await verifyCampaignOwnership(
        context.selectedCampaignId,
        context.user.id
      );
      return true;
    } catch {
      return new Error(
        "Invalid campaign ID or unauthorized access to campaign."
      );
    }
  }
);

export const permissions = shield(
  {
    Query: {
      // All queries require authentication by default
      "*": isAuthenticated,
      // Public queries
      healthCheck: allow,
      // Thread queries require campaign selection
      threads: hasCampaignSelected,
      getThread: hasCampaignSelected,
    },
    Mutation: {
      // All mutations require authentication by default
      "*": isAuthenticated,
      // Public mutations
      login: allow,
      // Message creation requires campaign selection
      createMessage: hasCampaignSelected,
    },
    Subscription: {
      "*": isAuthenticated,
      // Message generation requires campaign selection
      generateMessage: hasCampaignSelected,
    },
    // Allow all fields in LoginPayload to be accessed by anyone, needed for login
    LoginPayload: allow,
    // Allow User fields to be read (needed for login response and currentUser query)
    User: allow,
  },
  {
    // If an operation is not specified, deny access
    fallbackRule: isAuthenticated,
    // Allow external errors (e.g., from resolvers) to pass through
    allowExternalErrors: true,
  }
);
