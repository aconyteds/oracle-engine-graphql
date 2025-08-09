import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/modules/**/*.graphqls",
  generates: {
    "./src/modules/": {
      preset: "graphql-modules",
      presetConfig: {
        baseTypesPath: "../generated/graphql.ts",
        filename: "generated.ts",
      },
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        scalars: {
          DateTime: "string",
        },
        contextType: "../serverContext#ServerContext",
      },
    },
  },
};
export default config;
