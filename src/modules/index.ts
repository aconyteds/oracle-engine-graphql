import { createApplication, gql, createModule } from "graphql-modules";
import {
  resolvers as scalarResolvers,
  typeDefs as scalarTypeDefs,
} from "graphql-scalars";

import BaseModule from "./_base";
import UserModule from "./User";
import MessageModule from "./Message";
import ThreadModule from "./Thread";
import AIModule from "./AI";

const ROOT_MODULE = createModule({
  id: "_root",
  dirname: __dirname,
  typeDefs: gql(`
    ${scalarTypeDefs}

    type Query {
      _empty: String
    }

    type Mutation {
      _empty: String
    }

    type Subscription {
      _empty: String
    }

    schema {
      query: Query
      mutation: Mutation
    }
  `),
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
  ],
});

export default application;
