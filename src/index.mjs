/**
 * @file Entrypoint for the system.
 *
 * Responsible for setting up hooks and system-wide config/globals.
 */

// === Libraries ===============================================================

// === Hooks ===================================================================

/* --- Init --------------------------------------------------------------------
 * - Prepare settings
 * - Prepare Handlebars
 * - Add data structure for our subtypes of Actor, Item, and so on.
 * - Register sheets for actors, items, etc.
 * - Perform non-UI class overrides.
 */
import "./hooks/init.settings.mjs"
import "./hooks/init.handlebars.mjs"
import "./hooks/init.actors.mjs"
import "./hooks/init.items.mjs"
import "./hooks/init.combat.mjs"
import "./hooks/init.chat.mjs"
// import "./hooks/init.ui.mjs"

/* --- Setup -------------------------------------------------------------------
 * - Make our Party sidebar tab available.
 * - Override Foundry's sidebar with our extended sidebar.
 */
// import "./hooks/setup.partytab.mjs"
import "./hooks/setup.ui.mjs"

/* === DEV HELPERS =============================================================
 * These must be removed before the system is put into user hands.
 *
 * TODO: It would be cool to enable stuff like this for dev envs only
 */
Hooks.once("ready", async () => {
  try {
    const devAbility = "Item.8T913vV1JM1aVIRT"
    const actionItem = await fromUuid(devAbility)
    await actionItem.sheet.render(true)
    actionItem.resolveAction(actionItem.system.actions[0])
  } catch {
    // noop -- add your own devAbility UUID above if this breaks
  }

  const src = `http://${(window.location.host || "localhost").split(":")[0]}:9999/livereload.js?snipver=1`
  const script = document.createElement("script")
  script.src = src

  document.body.appendChild(script)
})
