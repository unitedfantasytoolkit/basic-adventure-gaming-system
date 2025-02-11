/**
 * @file The rollup config for this project. It outputs two bundles:
 * - bags.js      : the system code.
 * - components.js: various UI components used in system templates
 *
 * It also builds CSS (through postcss) and copies templates and assets.
 */

// === Build Tooling ===========================================================
import { defineConfig } from "rollup"

// === Node modules ============================================================
import { glob } from "glob"
import path from "path"

// === Rollup plugins ==========================================================

// --- Shared plugins ----------------------------------------------------------
import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import babel from "@rollup/plugin-babel"
// import eslint from "@rollup/plugin-eslint"
import livereload from "rollup-plugin-livereload"

// --- System-specific plugins -------------------------------------------------
import commonjs from "@rollup/plugin-commonjs"
import sourcemaps from "rollup-plugin-sourcemaps2"
import copy from "rollup-plugin-copy-assets"

// --- Component-specific plugins-----------------------------------------------
import cssImports from "rollup-plugin-import-css"

// === Build helpers ===========================================================
// --- Custom plugin: Extended Watcher -----------------------------------------
const watcher = (globs) => ({
  buildStart() {
    // eslint-disable-next-line no-restricted-syntax
    for (const item of globs) {
      glob.sync(path.resolve(item)).forEach((filename) => {
        this.addWatchFile(filename)
      })
    }
  },
})

// --- Helpful variables -------------------------------------------------------
/**
 * Rollup injects an environment variable if watch mode is used.
 * See: https://rollupjs.org/guide/en/#-w--watch
 */
const isWatchMode = !!process.env.ROLLUP_WATCH

// === Rollup Config ===========================================================

export default defineConfig([
  // - System ------------------------------------------------------------------
  {
    input: "./src/index.mjs",
    output: [
      {
        dir: "./dist",
        plugins: [terser()],
        sourcemap: true,
        format: "esm",
      },
    ],
    plugins: [
      sourcemaps(),
      nodeResolve({ browser: true }),
      commonjs(),
      babel({ babelHelpers: "bundled" }),
      // !isWatchMode && eslint(),
      !isWatchMode && terser(),
      copy({
        assets: [
          "src/assets",
          "src/templates",
          "src/lang",
          "src/lib",
          "src/system.json",
        ],
      }),
      isWatchMode &&
        watcher([
          "src/**/*.hbs",
          "src/**/*.html",
          "src/**/*.mjs",
          "src/**/*.js",
        ]),
      isWatchMode && livereload({ watch: "dist", port: 9999, delay: 1000 }),
    ],
  },

  // - Components --------------------------------------------------------------
  {
    input: "./src/components/index.mjs",
    output: {
      file: "./dist/components.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      cssImports({
        modules: true,
      }),
      babel({ babelHelpers: "bundled" }),
      // !isWatchMode && eslint(),
      !isWatchMode && terser(),
      // isWatchMode && watcher(["src/**/*.hbs", "src/**/*.html"]),
      // isWatchMode && livereload({ watch: "dist", port: 9999, delay: 1000 }),
    ],
  },
])
