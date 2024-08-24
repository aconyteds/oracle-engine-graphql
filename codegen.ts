import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/modules/**/*.graphqls",
  config: {
    scalars: {
      DateTime: "Date",
    },
  },
  generates: {
    "./src/modules/": {
      preset: "graphql-modules",
      presetConfig: {
        baseTypesPath: "../generated/graphql.ts",
        filename: "generated.ts",
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
      },
    },
  },
};
export default config;
