import type { User } from "@prisma/client";
import { ENV } from "../../config/environment";
import type { UserModule } from "./generated";

/**
 * Translates a Prisma User object to a GraphQL User type.
 * This ensures consistent mapping throughout the application.
 *
 * The isActive field behavior is controlled by the PUBLIC_ALLOWED environment variable:
 * - If PUBLIC_ALLOWED is set to "true", all users are treated as active (isActive = true)
 * - Otherwise, isActive is determined by checking if the user's subscription tier is not "Free"
 *
 * @param user - The Prisma User object from the database
 * @returns A UserModule.User object formatted for GraphQL responses
 */
export const translateUserToGraphQLUser = (user: User): UserModule.User => {
  // Determine isActive based on PUBLIC_ALLOWED flag
  let isActive: boolean;

  if (ENV.PUBLIC_ALLOWED === "true") {
    // When PUBLIC_ALLOWED is "true", all users are treated as active
    isActive = true;
  } else {
    // Otherwise, check subscription tier - Free tier users need to be explicitly active
    // Paid tiers (Tier1, Tier2, Tier3, Admin) are considered active by virtue of having a subscription
    isActive = user.subscriptionTier !== "Free" || user.active;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive,
    subscriptionTier: user.subscriptionTier,
  };
};
