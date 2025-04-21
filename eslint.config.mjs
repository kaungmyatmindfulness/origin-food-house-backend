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
      '@typescript-eslint/no-floating-promises': 'warn', // Warn about unhandled promises
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
        { allowNumber: true },
      ], // Allow numbers in template strings

      // --- Standard ESLint Rules ---
      'no-console': 'warn', // Warn about console.log statements
      'no-unused-vars': 'off', // Disable base rule, use @typescript-eslint version instead
      // Add any other specific rule overrides here
      // 'eqeqeq': ['error', 'always'], // Example: enforce strict equality
    },
  },
);
