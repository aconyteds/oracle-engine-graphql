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
