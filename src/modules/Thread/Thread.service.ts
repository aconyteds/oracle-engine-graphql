import type { PrismaClient } from "@prisma/client";

export class ThreadService {
  private _db: PrismaClient;
  public constructor(db: PrismaClient) {
    this._db = db;
  }

  public async getThread(threadId: string) {
    return this._db.thread.findUnique({
      where: {
        id: threadId,
      },
    });
  }

  public async getThreadMessages(threadId: string) {
    return this._db.message.findMany({
      where: {
        threadId,
      },
    });
  }

  public async getUserThreads(userId: string) {
    return this._db.thread.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }
}
