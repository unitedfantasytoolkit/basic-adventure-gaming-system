/**
 * @file Entrypoint for the system.
 *
 * Responsible for setting up hooks and system-wide config/globals.
 */

// === Libraries ===============================================================

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
import "./hooks/init.system-registration.mjs"
import "./hooks/init.settings.mjs"
import "./hooks/init.handlebars.mjs"
import "./hooks/init.actors.mjs"
import "./hooks/init.items.mjs"
import "./hooks/init.combat.mjs"
import "./hooks/init.chat.mjs"

/* --- Setup -------------------------------------------------------------------
 * - Make our Party sidebar tab available.
 * - Override Foundry's sidebar with our extended sidebar.
 */
import "./hooks/setup.ui.mjs"

/* === DEV HELPERS =============================================================
 * These must be removed before the system is put into user hands.
 *
 * TODO: It would be cool to enable stuff like this for dev envs only
 */
Hooks.once("ready", async () => {
  try {
    // fromUuidSync(
    //   "Actor.A81XqzmshDo9D55H.Item.Z2WUBXQlqDJV2m14",
    // ).sheet.subApps.actionEditor.render(true)
    // fromUuidSync(
    //   "Actor.A81XqzmshDo9D55H.Item.Z2WUBXQlqDJV2m14",
    // ).sheet.subApps.actionEditor.subApps.effectEditor.prepareToEdit(
    //   "KnA1hXmlZZrYpB9L",
    //   "DT5QUwSaRid33DaW",
    // )
    // fromUuidSync(
    //   "Actor.A81XqzmshDo9D55H.Item.Z2WUBXQlqDJV2m14",
    // ).sheet.subApps.actionEditor.subApps.effectEditor.render(true)
    fromUuidSync("Actor.A81XqzmshDo9D55H").sheet.render(true)
    // fromUuidSync("Actor.KT24QxIqGbFu9mZq").sheet.render(true)
    // fromUuidSync("Item.aRxw6uspU4Ipf9xN").sheet.render(true)
    // fromUuidSync("Actor.A81XqzmshDo9D55H.Item.Hg1akbcfs01x33LR").sheet.render(
    //   true,
    // )
  } catch {
    // noop -- use your own UUIDs above if this breaks
  }

  const src = `http://${(window.location.host || "localhost").split(":")[0]}:9999/livereload.js?snipver=1`
  const script = document.createElement("script")
  script.src = src

  document.body.appendChild(script)

  // ui.sidebar.toggleExpanded()
})
