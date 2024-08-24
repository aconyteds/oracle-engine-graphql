import { Module, createModule } from "graphql-modules";
import { loadFilesSync } from "@graphql-tools/load-files";
import MessageResolvers from "./Message.resolver";

// Load the schema as a string using @graphql-tools/load-files
const typeDefs = loadFilesSync(`${__dirname}./Message.schema.graphqls`, {
  extensions: ["graphqls"],
});

const MessageModule: Module = createModule({
  id: "Message",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [MessageResolvers],
});

export default MessageModule;
