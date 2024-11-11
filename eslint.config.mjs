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
    ignores: ["**/rollup.config.mjs", "**/lang/**/*.json", "**/*.d.ts"],
  },
  ...compat.extends("plugin:promise/recommended", "prettier"),
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
]
