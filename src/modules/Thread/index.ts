import type { Module } from "graphql-modules";
import { createModule } from "graphql-modules";
import { loadFilesSync } from "@graphql-tools/load-files";

import ThreadResolvers from "./Thread.resolver";

// Load the schema as a string using @graphql-tools/load-files
const typeDefs = loadFilesSync(`${__dirname}/Thread.schema.graphqls`, {
  extensions: ["graphqls"],
});

const ThreadModule: Module = createModule({
  id: "Thread",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [ThreadResolvers],
});

export default ThreadModule;
