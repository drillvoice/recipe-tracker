module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
    ecmaVersion: 2020,
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/node_modules/**/*", // Ignore dependencies.
  ],
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    // Enforce modern JavaScript
    "no-var": "error",
    "prefer-const": "error",
    "eqeqeq": ["error", "always"],

    // TypeScript specific rules
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",

    // Security rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",

    // Firebase Functions best practices
    "no-console": "off", // Allow console in Cloud Functions for logging
  },
};