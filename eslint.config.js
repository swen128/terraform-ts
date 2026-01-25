import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import eslintComments from "eslint-plugin-eslint-comments";
import functional from "eslint-plugin-functional";
import unicorn from "eslint-plugin-unicorn";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "bin/**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      functional: functional,
      unicorn: unicorn,
      "eslint-comments": eslintComments,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "functional/no-throw-statements": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "no-console": "error",
      "no-debugger": "error",
      "no-alert": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      "no-unused-expressions": "error",
      "no-unused-vars": "off",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "error",
      "no-fallthrough": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "unicorn/prefer-switch": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypePredicate",
          message:
            "Type predicates are not allowed because of the unsoundness. Rethink your type design.",
        },
        {
          selector: 'BinaryExpression[operator="in"]',
          message:
            "The `in` operator is not allowed. Use sum types so that you won't need them in the first place.",
        },
      ],
      "eslint-comments/no-use": ["error", { allow: [] }],
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "functional/no-throw-statements": "off",
    },
  },
  {
    files: ["bin/**/*.ts", "src/cli/**/*.ts"],
    rules: {
      "no-console": "off",
      "functional/no-throw-statements": "off",
    },
  },
  {
    files: ["src/facade/**/*.ts"],
    rules: {
      "functional/no-throw-statements": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  {
    ignores: ["node_modules/", "dist/", "*.config.js"],
  },
];
