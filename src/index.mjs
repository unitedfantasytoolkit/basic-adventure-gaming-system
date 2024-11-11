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
const devCharacter = "Actor.A81XqzmshDo9D55H"
const devAbility = `${devCharacter}.Item.BXFL6acXceuFHwo9`

Hooks.once("ready", async () => {
  if (!devCharacter) return
  const actor = await fromUuid(devCharacter)
  const actionItem = await fromUuid(devAbility)
  await actionItem.sheet.render(true)
  // await actor.sheet.render(true)
  window.TEST = { actor, actionItem }
  // window.TEST.actionItem.resolveAction(window.TEST.actionItem.system.actions[0])

  const src = `http://${(window.location.host || "localhost").split(":")[0]}:9999/livereload.js?snipver=1`
  const script = document.createElement("script")
  script.src = src

  document.body.appendChild(script)
})
