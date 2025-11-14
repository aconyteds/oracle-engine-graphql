import { loadFilesSync } from "@graphql-tools/load-files";
import type { Module } from "graphql-modules";
import { createModule } from "graphql-modules";

import CampaignAssetResolvers from "./CampaignAsset.resolver";

// Load the schema as a string using @graphql-tools/load-files
const typeDefs = loadFilesSync(`${__dirname}/CampaignAsset.schema.graphqls`, {
  extensions: ["graphqls"],
});

const CampaignAssetModule: Module = createModule({
  id: "CampaignAsset",
  dirname: __dirname,
  typeDefs: typeDefs,
  resolvers: [CampaignAssetResolvers],
});

export default CampaignAssetModule;
