import { Module, createModule } from "graphql-modules";
import { loadFilesSync } from "@graphql-tools/load-files";
import BaseResolvers from "./base.resolver";

const typeDefs = loadFilesSync(`${__dirname}/base.schema.graphqls`, {
  extensions: ["graphqls"],
});

const BaseModule: Module = createModule({
  id: "Base",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [BaseResolvers],
});

export default BaseModule;
