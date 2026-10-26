/**
 * @file Entrypoint for the system.
 *
 * Responsible for setting up hooks and system-wide config/globals.
 */

// === Libraries ===============================================================

// === E2E Tests ===============================================================
// Registers the Quench batches if Quench is installed. The tests themselves are
// a separate chunk, loaded on demand -- see src/quench/register.mjs.
import "./quench/register.mjs"

// === Utils ===================================================================

import { devOnly } from "./utils/dev-helpers.mjs"

// === Hooks ===================================================================

/* --- Rules modules registration ----------------------------------------------
 *
 *
 */
import "./hooks/bags.register-systems.bx.mjs"
import "./hooks/bags.register-systems.advanced.mjs"

/* --- Init --------------------------------------------------------------------
 * - Prepare rules modules
 * - Prepare settings
 * - Prepare Handlebars
 * - Add data structure for our subtypes of Actor, Item, and so on.
 * - Register sheets for actors, items, etc.
 * - Perform non-UI class overrides.
 */
import "./hooks/init.queries.mjs"
import "./hooks/init.system-registration.mjs"
import "./hooks/init.settings.mjs"
import "./hooks/init.handlebars.mjs"
import "./hooks/init.actors.mjs"
import "./hooks/init.items.mjs"
import "./hooks/init.combat.mjs"
import "./hooks/init.chat.mjs"
import "./hooks/init.dice.mjs"

/* --- Setup -------------------------------------------------------------------
 * - Make our Party sidebar tab available.
 * - Override Foundry's sidebar with our extended sidebar.
 */
import "./hooks/setup.ui.mjs"

/* --- Document lifecycle ------------------------------------------------------
 * - Update active effect editors when a Document's effects are altered
 * - Offer character creation when a blank character is created
 */
import "./hooks/updateActiveEffect.mjs"
import "./hooks/updateToken.movement-budget.mjs"
import "./hooks/spell-vocabulary.invalidation.mjs"
import "./hooks/createActor.character-creation.mjs"

/* === DEV HELPERS =============================================================
 * This code will only be included in development builds
 */
devOnly(() => {
  Hooks.once("ready", async () => {
    /*
     * A party to test against, built on demand rather than at startup so a dev
     * world isn't refilled with sample documents on every reload.
     *
     *   game.bags.createSampleData()
     *   game.bags.deleteSampleData()
     */
    const { createSampleData, deleteSampleData } = await import(
      "./dev/sample-data.mjs"
    )
    game.bags = { ...game.bags, createSampleData, deleteSampleData }

    try {
      fromUuidSync("Item.qhXlV5bYHMkuCfY6").sheet.render(true)
    } catch {
      // noop -- use your own UUIDs above if this breaks
    }

    /*
     * Connect to the livereload server that `rollup --watch` starts on port
     * 9999.
     *
     * `location.hostname` is used rather than splitting `location.host` on ":",
     * because an IPv6 host arrives as "[::1]:30000" and splitting on the colon
     * mangles it. The protocol is taken from the page so that a Foundry served
     * over https doesn't try to load this over http, which the browser would
     * block as mixed content.
     */
    const livereloadURL = new URL(
      "/livereload.js?snipver=1",
      `${window.location.protocol}//${window.location.hostname || "localhost"}:9999`,
    )

    if (!document.querySelector(`script[src^="${livereloadURL.origin}"]`)) {
      const script = document.createElement("script")
      script.src = livereloadURL.href
      script.addEventListener("error", () =>
        console.warn(
          `BAGS | Could not reach the livereload server at ${livereloadURL.origin}. Is "npm start" running?`,
        ),
      )
      document.body.appendChild(script)
    }

    // Dev convenience only, and not worth breaking startup over if a future
    // Foundry version renames it.
    try {
      ui.sidebar.toggleExpanded()
    } catch {
      // noop
    }
  })
})
