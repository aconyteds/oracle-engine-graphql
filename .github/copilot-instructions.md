This is a TypeScript GraphQL server which uses Apollo Server and Prisma. It is designed to be run in a Docker container. The server connects to a MongoDB Atlas database using Prisma. It uses Bun for all TypeScript code execution and unit tests. The team uses Github Actions for CI/CD, and the server is deployed to a Railway container.

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
