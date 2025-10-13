// ESLint Flat Config for phoTool (ESLint v9+)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginImport from "eslint-plugin-import";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "node_modules/**",
      "**/dist/**",
      "**/.storybook/**",
      ".dependency-cruiser.cjs",
      ".eslintrc.cjs",
      "eslint.config.mjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    },
    plugins: {
      import: pluginImport,
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "jsx-a11y": pluginJsxA11y
    },
    rules: {
      // Base
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],

      // TypeScript
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", disallowTypeAnnotations: false }
      ],
      "@typescript-eslint/no-explicit-any": ["error", { ignoreRestArgs: false }],

      // Import hygiene
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@PhoTool/shared", message: "Use @phoTool/shared (lowercase)" }
          ]
        }
      ],
      "import/order": [
        "warn",
        {
          groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true }
        }
      ],
      "import/no-cycle": "warn",

      // React
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // A11y
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/no-autofocus": "warn"
    },
    settings: {
      react: { version: "detect" }
    }
  }
];


