/**
 * @file Our eslint config!
 */
// === Imports ================================================================

// --- From Node --------------------------------------------------------------
import path from "node:path"
import { fileURLToPath } from "node:url"

// --- From eslint -------------------------------------------------------------
import js from "@eslint/js"
import { FlatCompat } from "@eslint/eslintrc"

// --- Plugins ----------------------------------------------------------------
import jsdoc from "eslint-plugin-jsdoc"
import prettier from "eslint-plugin-prettier"

// --- Project config ---------------------------------------------------------
import globals from "./.eslint/globals.js"
import rules from "./.eslint/rules.js"

// === Compatibility with the old config style ================================
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

// === ... and finally, our config ============================================
export default [
  {
    // Anything not authored by hand. Without these, eslint walks the build
    // output and the editor's vendored bundles, which produces tens of
    // thousands of messages and crashes the formatter outright.
    ignores: [
      "**/rollup.config.mjs",
      "**/lang/**/*.json",
      "**/*.d.ts",
      "dist/**",
      "coverage/**",
      "_scratch/**",
      ".vscode/**",
      ".aider*/**",
    ],
  },
  ...compat.extends("plugin:promise/recommended"),
  {
    plugins: {
      jsdoc,
      prettier,
    },

    languageOptions: {
      globals,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules,
  },
  // `eslint-config-prettier` must be applied LAST, after our own rules. Our
  // rules are harvested from AirBnB and re-enable ~19 layout rules (indent,
  // function-paren-newline, comma-spacing, quotes, ...) that prettier also
  // owns. When both are active, the two fixers rewrite the same character
  // ranges and `--fix` can corrupt code -- it has silently deleted a `.map(`
  // call and joined closing parens into `,)`. Letting prettier win makes it
  // the single authority on layout, so `--fix` is safe to run.
  ...compat.extends("prettier"),
]
