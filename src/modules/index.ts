import { createApplication, gql, createModule } from "graphql-modules";
import BaseModule from "./_base";
import UserModule from "./User";

const ROOT_MODULE = createModule({
  id: "_root",
  dirname: __dirname,
  typeDefs: gql`
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
  `,
  resolvers: {},
});

const application = createApplication({
  modules: [ROOT_MODULE, BaseModule, UserModule],
});

export default application;
