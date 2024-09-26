/**
 * @file Entrypoint for the system.
 *
 * Responsible for setting up hooks and system-wide config/globals.
 */

// === Libraries ===============================================================

// === Hooks ===================================================================
import "./hooks/devModeReady.mjs"
import "./hooks/init.settings.mjs"
import "./hooks/init.handlebars.mjs"
import "./hooks/init.actors.mjs"
import "./hooks/init.items.mjs"
import "./hooks/init.combat.mjs"
import "./hooks/updateGameTime.mjs"


Hooks.once("ready", async () => {
  const devsheet = (await fromUuid("Actor.A81XqzmshDo9D55H")).sheet.render(true)
})
