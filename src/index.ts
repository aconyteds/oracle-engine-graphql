declare module "bun" {
  interface Env {
    // The MongoDB connection string
    DATABASE_URL: string;
    // The OpenAI API Key
    OPENAI_API_KEY: string;
    // The Firebase Admin SDK service account key file as a base64 encoded string
    FIREBASE_CONFIG_BASE64?: string;
    // the WEBAPIKEY for Firebase
    FIREBASE_WEB_API_KEY: string;
    // The Sentry DSN for error tracking
    SENTRY_DSN?: string;
    // The environment the app is running in
    NODE_ENV?: string; // 'development' | 'production' | 'test'
    // Search metrics sampling rate (0.0 to 1.0)
    SEARCH_METRICS_SAMPLE_RATE?: string;
    // Hybrid search method: 'manual' (client-side RRF) or 'mongo' ($rankFusion)
    // Default: 'manual' (works on M0 tier)
    HYBRID_SEARCH_METHOD?: string;
    // Maximum number of entries to keep in the in-memory embedding cache
    // Optional; when unset, the default cache size configured in embeddingCache is used
    EMBEDDING_CACHE_MAX_SIZE?: string;
  }
}

import * as Sentry from "@sentry/bun";
import GraphQLServer from "./server";

// Initialize Sentry
// Use Bun.env for proper environment variable access in Bun runtime
const sentryDsn = Bun.env.SENTRY_DSN || process.env.SENTRY_DSN;
const nodeEnv = Bun.env.NODE_ENV || process.env.NODE_ENV || "development";
console.log(`Starting server in ${nodeEnv} mode.`);
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    serverName: "oracle-engine-graphql",
    environment: nodeEnv,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn", "log"] }),
    ],
    enableLogs: true,
    tracesSampleRate: 0.05,
  });
  // This needs to be here to verify Sentry is working in Bun
  Sentry.logger.info("Sentry initialized for oracle-engine-graphql", {
    action: "test_log",
    environment: nodeEnv,
  });
}

const startServer = async () => {
  const port = parseInt(process.env.PORT || "4000", 10);
  const path = "/graphql";
  const { httpServer } = await GraphQLServer(path);

  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  console.log(`Server is running on http://localhost:${port}${path}`);
};

startServer().catch((error: unknown) => {
  Sentry.captureException(error);
  console.error("Failed to start GraphQL server:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("Server is shutting down...");
  process.exit(0);
});
