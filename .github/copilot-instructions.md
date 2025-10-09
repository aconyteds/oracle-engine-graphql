This is a TypeScript GraphQL server which uses Apollo Server and Prisma. It is designed to be run in a Docker container. The server connects to a MongoDB Atlas database using Prisma. It uses Bun for all TypeScript code execution and unit tests. The team uses Github Actions for CI/CD, and the server is deployed to a Railway container.

You MUST use Bun for all TypeScript code execution.

### Common Commands

- `bun run <script>`: Run a script defined in package.json
- `bun test`: Run tests
- `bun build`: Build the project
- `bun run lint`: Run the linter

## Code Structure

- `src/`: Contains the source code for the server.
  - `data/`: Contains shared files for talking with downstream data sources.
  - `modules/`: Contains the GraphQL schema and resolvers.
  - `server.ts`: Contains the majority of the logic for instantiating the GraphQL server.
  - `index.ts`: The entry point for the server.
  - `graphql/`: Contains error handling and middleware for the GraphQL server.
    - `errors.ts`: Contains standardized errors for the GraphQL server.
- `e2e/`: Contains end-to-end tests for the server.
- `prisma/`: Contains the Prisma schema and client.
- `codegen.ts`: Contains the GraphQL code generation script.

Files should export a const or function with the same name as the file. For example, `src/modules/user.ts` should export a `user` const or function. All files should be exported from an index file in their respective directories. For example, `src/data/index.ts` should export all the files in the `data` directory, and `src/modules/index.ts` should export all the files in the `modules` directory.

## Typescript

- The code is written in TypeScript and uses Bun for all TypeScript code execution.
- When suggesting code, use strong typing instead of relying on inferred types.
- Use `const` and `let` instead of `var`.
- One method per file is preferred.
- Use `async/await` for asynchronous code.
- Use `Promise.all` for concurrent asynchronous code.

## GraphQL

- The server uses Apollo Server for GraphQL.
- The server follows the graphql-modules pattern for separating code into modules.
- All GraphQL fields, queries, and mutations must have a description.
- All methods which allow input should only accept a single input object as the only argument
- All GraphQL types are required to have a description.
- All input types must end with `Input`
- All queries and mutations return type names must end with `Payload`
- Schemas are defined in `module-name.schema.graphqls` files in the `src/modules/module-name` directory
- Resolvers are defined in `module-name.resolver.ts` files in the `src/modules/module-name` directory
- Modules are exported via index files in the `src/modules/module-name` directory like this:

```ts
// src/modules/user/index.ts
import type { Module } from "graphql-modules";
import { createModule } from "graphql-modules";
import { loadFilesSync } from "@graphql-tools/load-files";

import UserResolvers from "./User.resolver";

// Load the schema as a string using @graphql-tools/load-files
const typeDefs = loadFilesSync(`${__dirname}/User.schema.graphqls`, {
  extensions: ["graphqls"],
});

const UserModule: Module = createModule({
  id: "User",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [UserResolvers],
});

export default UserModule;
```

## Testing

- Unit tests use Bun's built-in test runner
- End-to-end tests use the `e2e` directory, but still use Bun's test runner.
- ALL code changes MUST include comprehensive unit tests
- Tests MUST pass before committing code (`bun test`)
- Lint errors MUST be fixed before committing (`bun run lint`)

### Test Requirements (MANDATORY)

When creating or modifying code, you MUST:

1. Write comprehensive unit tests for ALL functions
2. Run `bun test` to verify tests pass
3. Run `bun run lint` and fix ALL lint errors
4. Use proper Bun testing patterns: `import { test, expect, beforeEach, mock } from "bun:test"`
5. Mock external dependencies (database, API calls, etc.)
6. Test both success and error cases
7. Follow naming convention: `"Unit -> functionName description"`

### Test Structure Standards (MANDATORY)

Follow these patterns for consistent, maintainable tests:

1. **Default Mock Objects:** Create reusable default mock data at file level
2. **Centralized Mock Setup:** Configure all default mock behavior in `beforeEach()`
3. **Spread Pattern Usage:** Use `{...defaultObject, override: "value"}` instead of recreating objects
4. **Focused Test Changes:** Each test should only override what makes it unique
5. **Console Error Handling:** Mock `console.error` in error tests to suppress output and verify logging
6. **DRY Principle:** Eliminate duplicate mock setup across tests - aim for 20%+ code reduction

### Mocking Guidelines (CRITICAL - Dynamic Import Pattern REQUIRED)

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

**Why This Pattern Is Required:**

- Prevents module cache pollution between tests
- Ensures each test gets a fresh module instance with correct mocks
- Avoids race conditions when tests run in random order
- Required for reliable CI/CD test execution

### Example Test Structure (MANDATORY PATTERN)

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

### Common Mistakes to Avoid

❌ **DON'T** use top-level `mock.module()` calls:

```typescript
// WRONG - causes test pollution
const mockFunction = mock();
mock.module("./dependency", () => ({ func: mockFunction }));
import { functionUnderTest } from "./sourceFile";
```

❌ **DON'T** use `const` for mock variables:

```typescript
// WRONG - cannot reassign in beforeEach
const mockFunction = mock();
```

❌ **DON'T** mock barrel exports (index files):

```typescript
// WRONG - breaks other tests
mock.module("../../../data/AI", () => ({ ... }));
```

✅ **DO** use the dynamic import pattern:

```typescript
// CORRECT - proper test isolation
let mockFunction: ReturnType<typeof mock>;
beforeEach(async () => {
  mock.restore();
  mockFunction = mock();
  mock.module("./dependency", () => ({ func: mockFunction }));
  const module = await import("./sourceFile");
  functionUnderTest = module.functionUnderTest;
});
```
