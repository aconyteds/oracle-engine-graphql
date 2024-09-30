import { PrismaClient } from "@prisma/client";

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
    });
  }

  public async getThreadOptions(threadId: string) {
    const thread = await this._db.thread.findUnique({
      where: {
        id: threadId,
      },
      select: {
        threadOptions: true,
      },
    });

    return thread?.threadOptions;
  }
}
