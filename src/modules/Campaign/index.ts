import { loadFilesSync } from "@graphql-tools/load-files";
import type { Module } from "graphql-modules";
import { createModule } from "graphql-modules";

import CampaignResolvers from "./Campaign.resolver";

// Load the schema as a string using @graphql-tools/load-files
const typeDefs = loadFilesSync(`${__dirname}/Campaign.schema.graphqls`, {
  extensions: ["graphqls"],
});

const CampaignModule: Module = createModule({
  id: "Campaign",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [CampaignResolvers],
});

export default CampaignModule;
