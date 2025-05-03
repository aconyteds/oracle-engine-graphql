import { DBClient, User } from "../MongoDB";

/**
 * Looks up a user in the database by their Firebase Auth Account ID (googleAccountId).
 * If the user does not exist, it creates a new user with the provided email.
 * If the user exists, it updates the user's `updatedAt` timestamp.
 *
 * @param {string} userId - The Firebase Auth Account ID (googleAccountId) of the user.
 * @param {string} [email] - The email address of the user. This is optional and only used when creating a new user.
 * @returns {Promise<User>} - A promise that resolves to the user object from the database.
 *
 * @throws {Error} - Throws an error if the database operation fails.
 *
 * @example
 * const prisma = new PrismaClient();
 * const user = await lookupUser(prisma, 'firebase-auth-account-id', 'user@example.com');
 * console.log(user);
 */
export const lookupUser = async (
  userId: string,
  email?: string
): Promise<User> => {
  /**
   * The existing user object retrieved from the database.
   * @type {User | null}
   */
  const existingUser = await DBClient.user.findFirst({
    where: {
      googleAccountId: userId,
    },
  });

  if (!existingUser) {
    /**
     * The new user object created in the database.
     * @type {User}
     */
    const newUser = await DBClient.user.create({
      data: {
        googleAccountId: userId,
        email,
      },
    });
    return newUser;
  }

  await DBClient.user.update({
    where: {
      googleAccountId: userId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  return existingUser;
};
