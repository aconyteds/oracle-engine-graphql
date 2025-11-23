# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

**Development:**

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build the production bundle
- `bun start` - Run the production build
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Run ESLint with auto-fix
- `bun run format` - Format code with Prettier

**Testing:**

- `bun test` - Run unit tests (test-name-pattern: Unit)
- `bun run test:isolated` - Run unit tests in isolation (one file at a time) - RECOMMENDED for CI
- `bun test:e2e` - Run end-to-end tests (test-name-pattern: E2E)
- `bun run test:e2e:isolated` - Run E2E tests in isolation - RECOMMENDED for CI
- `bun run lint` - MUST be run after creating/modifying tests to fix lint errors
- `bun run lint:fix` - Auto-fix lint issues in test files

**Important:** Due to a bug in Bun's `mock.module()` (see [#7823](https://github.com/oven-sh/bun/issues/7823), [#6040](https://github.com/oven-sh/bun/issues/6040)), module mocks leak between test files. The `test:isolated` scripts run each test file individually to ensure proper isolation. Use these in CI and when debugging test failures.

**Database:**

- `bunx prisma generate` - Generate Prisma client after schema changes
- `bunx prisma db push` - Push schema changes to MongoDB and generate client
- `bun run vector-index:setup` - Create/verify Atlas Vector Search indexes

**GraphQL:**

- `bun run codegen` - Generate GraphQL types and resolvers (runs automatically after install)

**Docker:**

- `bun run docker:test` - Start Docker containers for testing
- `bun run docker:test:stop` - Stop Docker test containers

## Architecture Overview

### Core Technologies

- **Runtime:** Bun (not Node.js) - used for all TypeScript execution and testing
- **Server:** Apollo Server with GraphQL subscriptions over WebSockets
- **Database:** MongoDB Atlas with Prisma ORM
- **AI:** LangGraph workflows with OpenAI, Anthropic models and tool integration
- **Authentication:** Firebase Admin SDK

### Application Structure

**src/data/** - Data access layer with services for external systems:

- `AI/` - LangGraph workflows, agents, tools, and AI model definitions
  - `Workflows/toolEnabledWorkflow.ts` - Main LangGraph workflow for AI message generation
  - `Agents/` - Pre-configured AI agents (characterGenerator, cheapest)
  - `Tools/` - Available tools for AI agents (calculator, dice roller, RPG tools)
  - `Nodes/` - LangGraph workflow nodes (validateToolInput, generateWithTools, executeTools)
- `MongoDB/` - Prisma client and database operations
- `Firebase/` - Authentication and user management

**src/modules/** - GraphQL modules using graphql-modules pattern:

- Each module has: `*.schema.graphqls`, `*.resolver.ts`, `generated.ts`, `index.ts`
- `AI/` - Message generation with streaming subscriptions
- `Message/` - CRUD operations for messages
- `Thread/` - Conversation thread management
- `User/` - User authentication and profile management

**src/graphql/** - GraphQL middleware, permissions, and error handling

### Database Schema (Prisma + MongoDB)

**Core entities:**

- `User` - Firebase-authenticated users with Google Account ID
- `Thread` - Conversation threads with selected AI agent
- `Message` - Individual messages with token counts and workspace metadata
- `MessageWorkspace` - Tracks AI reasoning, tool calls, and execution results

**RPG-specific entities:**

- `Campaign` - RPG campaign settings and metadata
- `CampaignAsset` - NPCs, locations, plots with vector embeddings for search
- `SessionEvent` - Game session summaries and related assets

### Vector Search for Campaign Assets

The application includes semantic search capabilities for campaign assets using OpenAI embeddings and MongoDB Atlas Vector Search.

**Features:**
- Natural language search queries (e.g., "the old wizard who lives in the tower")
- Searches across NPCs, Locations, and Plots
- Filters by campaign ID and optionally by record type
- Returns similarity scores (0-1) with results
- Accessible via GraphQL query and as an AI tool

**GraphQL Query Example:**
```graphql
query SearchAssets($campaignId: ID!, $query: String!) {
  searchCampaignAssets(input: {
    campaignId: $campaignId
    query: $query
    recordType: Location  # Optional filter
    limit: 5              # Optional, default: 10
    minScore: 0.7         # Optional, default: 0.7
  }) {
    assets {
      asset {
        id
        name
        recordType
        summary
      }
      score
    }
  }
}
```

**AI Tool Usage:**
The `campaign_asset_search` tool is available to AI agents for searching campaign assets. It automatically filters results by campaign context and returns formatted results with detailed information.

**Technical Details:**
- Embeddings: OpenAI text-embedding-3-small (1536 dimensions)
- Similarity: Cosine similarity
- Index: MongoDB Atlas Vector Search index (`campaign_asset_vector_index`)
- Pre-filters: campaignId, recordType
- Implementation: [src/data/MongoDB/campaignAsset/vectorSearch.ts](src/data/MongoDB/campaignAsset/vectorSearch.ts)

### AI/LangGraph Integration

The system uses LangGraph for structured AI workflows:

1. **Tool-Enabled Workflow** (`src/data/AI/Workflows/toolEnabledWorkflow.ts`):
   - Validates input → Generates with tools → Executes tools → Generates final response
   - Supports streaming responses and tool execution tracking
   - Stores tool calls and results in message workspace

2. **Agents** are pre-configured with specific models, system messages, and available tools

3. **Tools** include common utilities (calculator, time) and RPG-specific tools (dice, character generation)

### Development Conventions

**TypeScript:**

- Use strict typing, avoid `any`
- One method per file preferred
- Export const/function with same name as filename
- All directories have index.ts files for exports

**Testing:**

- ALL code changes MUST include unit tests
- Tests MUST pass before committing code (`bun test`)
- Lint errors MUST be fixed before committing (`bun run lint`)
- Use Bun's testing framework: `import { test, expect, beforeEach, mock } from "bun:test"`
- Test files should be named `*.test.ts` and placed alongside the source file
- Test naming convention: `"Unit -> functionName describes what it tests"`

**Mocking Guidelines (CRITICAL - Dynamic Import Pattern REQUIRED):**

To ensure proper test isolation and prevent cross-test contamination, you MUST follow this dynamic import pattern when using `mock.module()`:

1. **Declare mock variables with `let`** at the top of the `describe` block (NOT as constants)
2. **Use `async beforeEach()`** to set up mocks before each test
3. **Call `mock.restore()`** at the start of `beforeEach()` to clear all previous mocks
4. **Create fresh mock instances** in `beforeEach()` for each test
5. **Set up `mock.module()`** calls inside `beforeEach()` (NOT at the top level)
6. **Use `await import()`** to dynamically import the module under test
7. **Assign to variables** declared in the `describe` block
8. **Use `afterEach()`** instead of `afterAll()` and call `mock.restore()`
9. **Mock specific submodules** instead of barrel exports (e.g., `./calculateTokenCount` not `./index`)

**Test Structure Best Practices:**

- **Dynamic Imports:** ALWAYS use `await import()` inside `beforeEach()` when mocking modules
- **Fresh Mocks:** Create new mock instances in `beforeEach()` to avoid state pollution
- **Default Mock Data:** Define reusable default data as constants in `describe` block
- **Centralized Setup:** Configure all default mock behavior in `beforeEach()` after dynamic import
- **Spread Operator:** Use `{...defaultObject, specificOverride: "value"}` pattern
- **Test Focus:** Each test should only override what makes it unique
- **Console Mocking:** Mock `console.error` in error tests to suppress output and verify logging
- **Clean Imports:** Never import the module under test at the top level when using `mock.module()`

**Example Test Structure (MANDATORY PATTERN):**

```typescript
import { test, expect, beforeEach, mock, describe, afterEach } from "bun:test";
import type { TypeFromClient } from "./client";

describe("functionUnderTest", () => {
  // Declare mock variables with 'let' (NOT const)
  let mockFunction: ReturnType<typeof mock>;
  let mockDBClient: {
    operation: {
      method: ReturnType<typeof mock>;
    };
  };
  let functionUnderTest: typeof import("./sourceFile").functionUnderTest;

  // Default mock data - reusable across tests
  const defaultUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  };

  const defaultResult = {
    success: true,
    data: "expected data",
  };

  beforeEach(async () => {
    // CRITICAL: Restore all mocks first
    mock.restore();

    // Create fresh mock instances
    mockFunction = mock();
    const mockMethod = mock();
    mockDBClient = {
      operation: {
        method: mockMethod,
      },
    };

    // Set up module mocks INSIDE beforeEach
    mock.module("./dependency", () => ({
      functionName: mockFunction,
      DBClient: mockDBClient,
    }));

    // Dynamically import the module under test
    const module = await import("./sourceFile");
    functionUnderTest = module.functionUnderTest;

    // Configure default mock behavior AFTER import
    mockFunction.mockResolvedValue(defaultResult);
    mockDBClient.operation.method.mockResolvedValue(defaultUser);
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  test("Unit -> functionUnderTest handles basic case", async () => {
    const result = await functionUnderTest("input");

    expect(mockFunction).toHaveBeenCalledWith("input");
    expect(result).toEqual(defaultResult);
  });

  test("Unit -> functionUnderTest handles custom user", async () => {
    const customUser = { ...defaultUser, name: "Custom User" };
    mockDBClient.operation.method.mockResolvedValue(customUser);

    const result = await functionUnderTest("input");

    expect(result.user).toEqual(customUser);
  });

  test("Unit -> functionUnderTest handles errors with console mocking", async () => {
    const originalConsoleError = console.error;
    const mockConsoleError = mock();
    console.error = mockConsoleError;

    const testError = new Error("Test error");
    mockFunction.mockRejectedValue(testError);

    try {
      await expect(functionUnderTest("input")).rejects.toThrow("Test error");
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error occurred:",
        testError
      );
    } finally {
      console.error = originalConsoleError;
    }
  });
});
```

**Why Dynamic Imports Are Required:**

- Prevents module cache pollution between tests
- Ensures each test gets a fresh module instance with correct mocks
- Avoids race conditions when tests run in random order
- Required for reliable CI/CD test execution

**Known Limitation - Module Mock Isolation:**

Despite following the dynamic import pattern, Bun has a known bug where `mock.module()` mocks leak between test files and `mock.restore()` does not properly clear module-level mocks ([#7823](https://github.com/oven-sh/bun/issues/7823), [#6040](https://github.com/oven-sh/bun/issues/6040)).

**Workaround:** Use `bun run test:isolated` which runs each test file individually to ensure complete isolation. This is automatically used in CI via the `scripts/run-isolated-tests.sh` script. Once Bun fixes these issues, we can return to running all tests together for better performance.

**GraphQL:**

- All fields, queries, mutations require descriptions
- Input types end with `Input`, return types end with `Payload`
- Single input object parameter for all operations
- Modules follow: schema.graphqls + resolver.ts + generated.ts + index.ts

**File Organization:**

- Generated files in `src/generated/` (ignored by linting)
- Services organized by domain in respective module directories
- All modules exported through index files

### Environment Requirements

Required environment variables:

```bash
OPENAI_API_KEY=<openai-api-key>
FIREBASE_WEB_API_KEY=<firebase-web-api-key>
GOOGLE_APPLICATION_CREDENTIALS="credentials.json"
DATABASE_URL="mongodb://localhost:27017/OracleEngine?retryWrites=true&w=majority"
```

### API Usage

Server runs on http://localhost:4000/graphql with GraphQL Playground for development.

Authentication flow:

1. Login mutation returns JWT token
2. Use `Authorization: Bearer <token>` header for authenticated requests
3. Tokens expire and require re-authentication

Key operations:

- `generateMessage` subscription - Streams AI responses with tool usage
- `createMessage` mutation - Adds user messages to threads
- `threads` query - Gets user's conversation history

## Testing Requirements (MANDATORY)

When creating or modifying code, you MUST:

1. Write comprehensive unit tests for ALL functions
2. Run `bun test` to verify tests pass
3. Run `bun run lint` and fix ALL lint errors
4. Use proper Bun testing patterns as documented above
5. Mock external dependencies (database, API calls, etc.)
6. Test both success and error cases
7. Follow the naming convention: `"Unit -> functionName description"`

## Code Quality Standards

- ALL code changes require unit tests before committing
- Tests must pass and lint errors must be resolved
- Use TypeScript strict mode, avoid `any` types
- Mock dependencies properly using Bun's `mock.module()` pattern
- Test files should be comprehensive and cover edge cases

## Test Organization Standards (MANDATORY)

When writing tests, you MUST follow these patterns to maintain consistency and reduce maintenance:

1. **Default Mock Objects:** Always create reusable default mock data at file level
2. **Centralized Mock Setup:** Configure all default mock behavior in `beforeEach()`
3. **Spread Pattern Usage:** Use `{...defaultObject, override: "value"}` instead of recreating objects
4. **Focused Test Changes:** Each test should only override what makes it unique
5. **Console Error Handling:** Mock `console.error` in error tests to suppress output and verify logging
6. **DRY Principle:** Eliminate duplicate mock setup across tests - aim for 20%+ code reduction

This approach ensures tests are maintainable, readable, and follow consistent patterns across the codebase.
