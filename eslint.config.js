import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // src/types/reson8-protocol/** is a vendored snapshot (Phase 1 PRD P1.2)
    // — no modification beyond its header comment, so it isn't linted here.
    ignores: [
      "dist",
      "dev-dist",
      "coverage",
      "playwright-report",
      "test-results",
      "src/types/reson8-protocol/**",
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.flatConfigs.recommended,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.config.{ts,js}", "src/test/**", "**/*.test.{ts,tsx}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // shadcn/ui primitives: copied-in library components, not app feature
    // code (master PRD §3). They intentionally co-export a `*Variants` cva
    // helper alongside the component, and `Label` is a generic wrapper whose
    // htmlFor/control association only exists at each call site, which
    // static analysis can't trace through the primitive.
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
  eslintConfigPrettier,
);
