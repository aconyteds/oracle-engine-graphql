import { Client } from "langsmith";

/**
 * LangSmith Client singleton.
 *
 * Auto-configured via environment variables:
 * - LANGSMITH_API_KEY: API key for authentication
 * - LANGSMITH_ENDPOINT: API endpoint (optional, defaults to https://api.smith.langchain.com)
 * - LANGSMITH_PROJECT: Project name for organizing traces
 */
export const LangSmithClient = new Client();
