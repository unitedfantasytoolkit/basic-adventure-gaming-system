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
import fs from "fs"
import path from "path"

// === Rollup plugins ==========================================================

// --- Shared plugins ----------------------------------------------------------
import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import babel from "@rollup/plugin-babel"
import replace from "@rollup/plugin-replace"
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

// --- Custom plugin: Stale Chunk Cleanup --------------------------------------
/**
 * What a code-split chunk is named: rollup's default `[name]-[hash].js`, with an
 * 8-character hash, plus the sourcemap written beside it.
 */
const HASHED_CHUNK = /-[\w-]{8}\.js(\.map)?$/

/**
 * Delete code-split chunks left over from earlier builds.
 *
 * Every dynamic `import()` becomes a chunk named after its content hash, so each
 * rebuild writes new files next to the old ones and nothing removes them. Emptying
 * `dist/` first is not an option: it also holds `packs/` (compendium databases a
 * running Foundry writes to), `bags.css` (built by postcss alongside this) and
 * Foundry's lock file.
 *
 * So this removes only files shaped like a hashed chunk that this build did not
 * just write, and only once the new ones are on disk -- the live `index.js` never
 * points at a chunk that has gone.
 * @returns {import("rollup").Plugin} The plugin.
 */
const cleanStaleChunks = () => ({
  name: "clean-stale-chunks",
  writeBundle(options, bundle) {
    const written = new Set(
      Object.keys(bundle).flatMap((name) => [name, `${name}.map`]),
    )

    fs.readdirSync(options.dir)
      .filter((name) => HASHED_CHUNK.test(name) && !written.has(name))
      .forEach((name) => fs.rmSync(path.join(options.dir, name)))
  },
})

// --- Helpful variables -------------------------------------------------------
/**
 * Rollup injects an environment variable if watch mode is used.
 * See: https://rollupjs.org/guide/en/#-w--watch
 */
const isWatchMode = !!process.env.ROLLUP_WATCH

/**
 * Whether to build development-only code, which is what the `__DEV__` flag
 * gates.
 *
 * Watch mode always counts as development. `BAGS_DEV=1` exists so a one-off
 * build can also be a development build: `npm run build` writes to the same
 * `dist/` that `npm start` watches, so a production build run mid-session used
 * to silently strip the livereload client and leave hot reload dead until the
 * next source change.
 */
const isDev = isWatchMode || process.env.BAGS_DEV === "1"

/**
 * Files worth reloading the browser for.
 *
 * Deliberately not the whole of `dist/`: `dist/packs/` holds LevelDB compendium
 * data that a running Foundry writes to on its own, which would trigger reloads
 * that have nothing to do with a code change.
 */
const livereloadTargets = [
  "dist/index.js",
  "dist/components.js",
  "dist/bags.css",
  "dist/templates",
  "dist/lang",
]

// === Rollup Config ===========================================================

export default defineConfig([
  // - System ------------------------------------------------------------------
  {
    input: "./src/index.mjs",
    output: [
      {
        // Minification is applied as a build plugin below, for production only.
        // Having it here as well minified development builds too, and ran
        // terser twice over production ones.
        dir: "./dist",
        sourcemap: true,
        format: "esm",
      },
    ],
    plugins: [
      sourcemaps(),
      replace({
        preventAssignment: true,
        __DEV__: JSON.stringify(isDev),
      }),
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
          "src/**/*.json",
        ]),
      isWatchMode &&
        livereload({ watch: livereloadTargets, port: 9999, delay: 1000 }),
      cleanStaleChunks(),
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
      replace({
        preventAssignment: true,
        __DEV__: JSON.stringify(isDev),
      }),
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
