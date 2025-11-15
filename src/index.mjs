/**
 * @file Entrypoint for the system.
 *
 * Responsible for setting up hooks and system-wide config/globals.
 */

// === Libraries ===============================================================

// === Utils ===================================================================

import { devOnly } from "./utils/dev-helpers.mjs"

// === Hooks ===================================================================

/* --- Rules modules registration ----------------------------------------------
 *
 *
 */
import "./hooks/bags.register-systems.bx.mjs"

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
 */
import "./hooks/updateActiveEffect.mjs"

/* === DEV HELPERS =============================================================
 * This code will only be included in development builds
 */
devOnly(() => {
  Hooks.once("ready", async () => {
    try {
      fromUuidSync("Item.qhXlV5bYHMkuCfY6").sheet.render(true)
    } catch {
      // noop -- use your own UUIDs above if this breaks
    }

    // Add livereload script in development mode
    const src = `${window.location.protocol}/${(window.location.host || "localhost").split(":")[0]}:9999/livereload.js?snipver=1`
    const script = document.createElement("script")
    script.src = src
    document.body.appendChild(script)

    ui.sidebar.toggleExpanded()
  })
})
