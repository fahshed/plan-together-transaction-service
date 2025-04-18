import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    rules: {
      eqeqeq: ["error", "always"], // Enforce strict equality
      curly: ["error", "all"], // Require curly braces for all control statements
      "no-console": "warn", // Warn on console usage
      "no-alert": "error", // Disallow alert, confirm, and prompt
      "no-debugger": "error", // Disallow debugger statements
      strict: "off", // Turn off strict mode enforcement
      "no-unused-vars": [
        "error",
        { args: "after-used", ignoreRestSiblings: true },
      ], // Disallow unused variables
      "no-implicit-globals": "error", // Disallow implicit global variables
      "no-var": "error", // Require let or const instead of var
      "prefer-const": ["error", { destructuring: "all" }], // Suggest using const
      "prefer-arrow-callback": "error", // Suggest using arrow functions as callbacks
      "no-magic-numbers": [
        "warn",
        {
          ignore: [0, 1],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ], // Disallow magic numbers
      complexity: ["warn", { max: 10 }], // Limit cyclomatic complexity
      "max-depth": ["warn", 4], // Limit nested blocks
      "max-lines": ["warn", 300], // Limit lines per file
      "max-params": ["warn", 3], // Limit parameters per function
      "max-statements": "off",
    },
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.browser },
  },
]);
