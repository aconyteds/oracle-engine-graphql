import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import pluginImport from "eslint-plugin-import";

export default [
  {
    files: ["src/**/*.{ts}", "e2e/**/*.{ts}"], // Limit to ts and graphqls files in src and e2e
    ignores: ["node_modules", "dist", "build", "*generated*"], // Ignore unnecessary directories
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json", // Make sure to point to your tsconfig.json
        moduleResolution: "node",
      },
      globals: {
        ...globals.node, // Node.js globals for backend projects
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "import": pluginImport,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",

      // Import rules
      "import/order": [
        "warn",
        {
          groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
          "newlines-between": "always",
        },
      ],
      "import/newline-after-import": "warn",
      "import/no-unresolved": "off",
    },
  },
];
