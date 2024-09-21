import { PrismaClient, User } from "@prisma/client";

export const lookupUser = async (
  _db: PrismaClient,
  userId: string,
  email?: string
): Promise<User> => {
  const existingUser = await _db.user.findFirst({
    where: {
      googleAccountId: userId,
    },
  });
  if (!existingUser) {
    const newUser = await _db.user.create({
      data: {
        googleAccountId: userId,
        email,
      },
    });
    return newUser;
  }
  await _db.user.update({
    where: {
      googleAccountId: userId,
    },
    data: {
      updatedAt: new Date(),
    },
  });
  return existingUser;
};
