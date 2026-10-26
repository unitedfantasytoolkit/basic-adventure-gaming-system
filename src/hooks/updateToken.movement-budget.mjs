/**
 * @file Keep the combat tracker's movement bars honest.
 *
 * The tracker draws how much of the round's movement each combatant has spent,
 * but nothing about moving a token re-renders it: Foundry re-renders the tracker
 * for combat and combatant updates, and a token's movement is neither. Left
 * alone the bars show whatever was true when the sidebar last drew, which is
 * worse than showing nothing -- a referee reads a full bar and believes it.
 *
 * Found by playing a fight rather than by testing one. Three orcs charged 25 to
 * 30 feet and every bar still read a full 40.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"

/**
 * Redraw the tracker, no more than once per animation frame's worth of moves.
 *
 * A single drag emits several updates as the token passes waypoints, and each
 * one would otherwise queue a full re-render of the sidebar.
 * @type {Function}
 */
const redraw = foundry.utils.debounce(() => ui.combat?.render(), 100)

Hooks.on("updateToken", (token, changes) => {
  // `_movementHistory` is present both when a token moves and when a history is
  // cleared, which are exactly the two moments a bar's value changes. Watching
  // `x`/`y` instead would miss the clearing and fire for teleports that record
  // nothing.
  if (!("_movementHistory" in changes)) return

  // Matched on each combatant's own scene, not on the combat's. Foundry creates
  // encounters unlinked from any scene by default, and an unlinked combat's
  // `scene` is null -- so comparing against it ruled out every move, and the
  // bars only caught up when something unrelated redrew the tracker.
  const combat = ui.combat?.viewed
  const sceneId = token.parent?.id
  const isCombatant = combat?.combatants.some(
    (combatant) =>
      combatant.tokenId === token.id && combatant.sceneId === sceneId,
  )
  if (!isCombatant) return

  // Nothing on screen depends on it when the bars are turned off.
  try {
    if (!game.settings.get(SYSTEM_NAME, "showMovementBudget")) return
  } catch {
    return
  }

  redraw()
})
