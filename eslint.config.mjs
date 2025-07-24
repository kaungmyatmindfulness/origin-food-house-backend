// eslint.config.mjs
// @ts-check  // Enables type checking for this config file
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 1. Files to ignore
  {
    ignores: [
      'eslint.config.mjs', // Ignore self
      'sync-postman.js', // Ignore specific script
      'dist/', // Ignore build output
      'node_modules/', // Ignore dependencies
    ],
  },

  // 2. Base ESLint recommended rules
  eslint.configs.recommended,

  // 3. TypeScript Recommended Type-Checked rules
  // Ensure you have a tsconfig.json configured correctly
  ...tseslint.configs.recommendedTypeChecked,

  // 4. Prettier integration (disables conflicting ESLint rules)
  // Make sure this comes AFTER other rule sets it might conflict with
  eslintPluginPrettierRecommended,

  // 5. Language and Parser Options
  {
    languageOptions: {
      globals: {
        ...globals.node, // Add common Node.js globals
        ...globals.jest, // Add Jest testing globals
      },
      // Use 'latest' or a specific recent year (e.g., 2023)
      // Avoid ES5 for modern TypeScript/Node.js projects
      ecmaVersion: 'latest', // <-- ADJUSTED: Use modern ECMAScript features
      sourceType: 'module', // Use ES modules (import/export)
      parserOptions: {
        // Link to your project's tsconfig for type-aware rules
        // Use 'project: true' instead of deprecated 'projectService'
        project: true, // <-- ADJUSTED: Enable type-aware linting
        tsconfigRootDir: import.meta.dirname, // Correctly finds tsconfig relative to this file
      },
    },
    // Apply these options specifically to TS files if needed, but often okay globally
    // files: ['**/*.ts', '**/*.tsx'], // Example: Apply only to TS files
  },

  // 6. Custom Rule Overrides/Additions
  {
    rules: {
      // --- TypeScript Rules ---
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for 'any' type
      '@typescript-eslint/no-floating-promises': 'error', // Error for unhandled promises (critical for transactions)
      '@typescript-eslint/no-unsafe-argument': 'warn', // Warn about unsafe 'any' usage in arguments
      '@typescript-eslint/no-unsafe-assignment': 'warn', // Warn about unsafe 'any' assignments
      '@typescript-eslint/no-unsafe-call': 'warn', // Warn about unsafe 'any' calls
      '@typescript-eslint/no-unsafe-member-access': 'warn', // Warn about unsafe 'any' member access
      '@typescript-eslint/no-unused-vars': [
        // Warn about unused variables/params
        'warn',
        {
          argsIgnorePattern: '^_', // Ignore if starting with _
          varsIgnorePattern: '^_', // Ignore if starting with _
          caughtErrorsIgnorePattern: '^_', // Ignore caught errors starting with _
        },
      ],
      '@typescript-eslint/require-await': 'warn', // Warn if async function lacks await
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true, allowBoolean: true },
      ], // Allow numbers and booleans in template strings
      '@typescript-eslint/prefer-nullish-coalescing': 'error', // Use ?? instead of ||
      '@typescript-eslint/prefer-optional-chain': 'error', // Use optional chaining
      '@typescript-eslint/no-misused-promises': 'error', // Prevent Promise misuse in conditionals

      // --- NestJS/Backend Specific Rules ---
      'no-console': 'error', // Error for console.log (use Logger instead)
      'no-unused-vars': 'off', // Disable base rule, use @typescript-eslint version instead
      eqeqeq: ['error', 'always'], // Enforce strict equality
      'prefer-const': 'error', // Prefer const over let when possible
      'no-var': 'error', // Disallow var keyword
      'object-shorthand': 'error', // Prefer object shorthand syntax
      'prefer-destructuring': ['warn', { object: true, array: false }], // Encourage destructuring

      // --- Async/Promise Rules (Critical for DB operations) ---
      'no-return-await': 'off', // Disable base rule
      '@typescript-eslint/return-await': ['error', 'always'], // Always return await for better stack traces
      'require-await': 'off', // Disable base rule

      // --- Import/Export Rules ---
      'no-duplicate-imports': 'error', // Prevent duplicate imports

      // --- Security Rules ---
      'no-eval': 'error', // Prevent eval usage
      'no-implied-eval': 'error', // Prevent implied eval
      'no-new-func': 'error', // Prevent Function constructor

      // --- Database/Prisma Specific Patterns ---
      'prefer-template': 'error', // Use template literals instead of concatenation
    },
  },
);
