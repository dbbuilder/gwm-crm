/** @type {import("eslint").Linter.Config} */
const config = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "next/core-web-vitals",
    "@typescript-eslint/recommended-type-checked",
    "@typescript-eslint/stylistic-type-checked",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  rules: {
    // TypeScript-specific rules
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/consistent-type-definitions": "off",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      },
    ],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        checksVoidReturn: { attributes: false },
      },
    ],

    // Import rules
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],
    "import/no-unresolved": "error",

    // React/Next.js rules
    "react/jsx-key": "error",
    "react/no-unescaped-entities": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "error",
    "no-var": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-debugger": "error",
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
    },
  },
  overrides: [
    {
      files: ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx"],
      rules: {
        "@typescript-eslint/no-unused-expressions": "off",
      },
    },
    {
      files: ["tailwind.config.ts"],
      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};

module.exports = config;