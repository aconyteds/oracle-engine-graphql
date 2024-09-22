import { Module, createModule } from "graphql-modules";
import { loadFilesSync } from "@graphql-tools/load-files";
import AIResolvers from "./AI.resolver";

// Load the schema as a string using @graphql-tools/load-files
const typeDefs = loadFilesSync(`${__dirname}/AI.schema.graphqls`, {
  extensions: ["graphqls"],
});

const AIModule: Module = createModule({
  id: "AI",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [AIResolvers],
});

export default AIModule;
