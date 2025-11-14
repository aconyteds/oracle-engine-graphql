import { createApplication, createModule, gql } from "graphql-modules";
import {
  resolvers as scalarResolvers,
  typeDefs as scalarTypeDefs,
} from "graphql-scalars";

import BaseModule from "./_base";
import AIModule from "./AI";
import CampaignModule from "./Campaign";
import CampaignAssetModule from "./CampaignAsset";
import MessageModule from "./Message";
import ThreadModule from "./Thread";
import UserModule from "./User";

const combinedTypeDefs = `${scalarTypeDefs.join("\n")}\n\n  type Query {\n    _empty: String\n  }\n\n  type Mutation {\n    _empty: String\n  }\n\n  type Subscription {\n    _empty: String\n  }\n\n  schema {\n    query: Query\n    mutation: Mutation\n  }`;

const rootTypeDefs = gql(combinedTypeDefs);

const ROOT_MODULE = createModule({
  id: "_root",
  dirname: __dirname,
  typeDefs: rootTypeDefs,
  resolvers: {
    ...scalarResolvers,
  },
});

const application = createApplication({
  modules: [
    ROOT_MODULE,
    BaseModule,
    UserModule,
    MessageModule,
    ThreadModule,
    AIModule,
    CampaignModule,
    CampaignAssetModule,
  ],
});

export default application;
