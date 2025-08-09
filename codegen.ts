import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/modules/**/*.graphqls",
  generates: {
    "./src/modules/": {
      preset: "graphql-modules",
      presetConfig: {
        baseTypesPath: "../generated/graphql.ts",
        filename: "generated.ts",
        contextType: "./src/serverContext#GraphQLServerContext",
      },
      plugins: [
        {
          add: {
            content: "/* eslint-disable */",
          },
        },
        "typescript",
        "typescript-resolvers",
      ],
      config: {
        scalars: {
          DateTime: "string",
        },
        contextType: "src/serverContext#GraphQLServerContext",
      },
    },
  },
};
export default config;
