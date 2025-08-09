import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import pluginImport from "eslint-plugin-import";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "**/*generated*",
      "src/generated/**/*",
      "**/*.d.ts",
      "test-*.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: pluginImport,
    },
    rules: {
      // Basic TypeScript rules that catch type errors
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",

      // Additional recommended rules
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",

      "import/newline-after-import": "warn",
      "import/no-unresolved": "off",
    },
  },
];
