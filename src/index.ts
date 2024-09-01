declare module "bun" {
  interface Env {
    // The MongoDB connection string
    DATABASE_URL: string;
    // The OpenAI API Key
    OPENAI_API_KEY: string;
  }
}

import GraphQLServer from "./server";

const startServer = async () => {
  const port = parseInt(process.env.PORT || "4000", 10);
  const path = "/graphql";
  const { httpServer } = await GraphQLServer(path);

  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  console.log(`🚀 Server is running on http://localhost:${port}${path}`);
};

startServer();
