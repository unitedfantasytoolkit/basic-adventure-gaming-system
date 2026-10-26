/**
 * @file How much of its movement a combatant has spent this round.
 *
 * Foundry already measures movement: every token keeps a `movementHistory` of
 * waypoints, each carrying the distance it cost. What it does not do is relate
 * that to an allowance, because an allowance is a rules question -- and BAGS
 * already answers it. `system.speed.encounter` is the distance a creature covers
 * in one combat round, derived by the selected encumbrance module from its base
 * speed and what it is carrying.
 *
 * So this module is only arithmetic and honesty about missing data. It reads
 * plain properties, which keeps it testable without a running game.
 */

/**
 * Add up what a token's recorded movement cost.
 *
 * Waypoint costs can legitimately be `Infinity` -- Foundry uses it for movement
 * whose cost cannot be measured, and defaults to it when a waypoint arrives
 * without one (`token.mjs:469`). Summing that would make the budget read as
 * spent forever, so unmeasurable steps are skipped rather than counted.
 * @param {TokenDocument|null} token - The token whose history to read.
 * @returns {number} Distance moved, in the scene's units.
 */
export const movementUsedBy = (token) => {
  const history = token?.movementHistory
  if (!Array.isArray(history)) return 0

  return history.reduce(
    (total, waypoint) =>
      Number.isFinite(waypoint?.cost) ? total + waypoint.cost : total,
    0,
  )
}

/**
 * How far a combatant may move in one round.
 *
 * Read from the encumbrance module's `encounter` category rather than computed
 * here: how much a laden character slows down is a rules decision that BAGS
 * already makes in one place, and making it again here would let the two drift.
 * @param {Combatant|null} combatant - The combatant to measure.
 * @returns {number} The round's allowance, or 0 when there is nothing to read.
 */
export const movementBudgetFor = (combatant) => {
  const encounter = combatant?.actor?.system?.speed?.encounter
  return Number.isFinite(encounter) && encounter > 0 ? encounter : 0
}

/**
 * Everything the tracker needs to draw a combatant's movement for this round.
 *
 * Returns null when there is nothing worth drawing -- no allowance to measure
 * against, which is the ordinary state of a monster whose sheet nobody filled
 * in. A bar with no denominator is a bar that means nothing.
 * @param {Combatant|null} combatant - The combatant to measure.
 * @returns {{used: number, max: number, remaining: number, percent: number,
 * exhausted: boolean, over: boolean}|null} The round's movement, or null.
 */
export const movementStatusFor = (combatant) => {
  const max = movementBudgetFor(combatant)
  if (!max) return null

  const used = movementUsedBy(combatant?.token)

  // Rounded for display only. Encounter movement is a third of a base speed, so
  // it is frequently fractional -- a base 100 gives 33.333 -- and a tracker row
  // is not the place for that. The comparisons below use the raw values.
  const show = (value) => Math.round(value * 10) / 10

  return {
    used: show(used),
    max: show(max),
    // Never negative: a combatant who has overspent has nothing left, not a
    // debt. The overspend is reported separately, because it is a different
    // thing to say and the two are easily confused.
    remaining: show(Math.max(0, max - used)),
    // Capped so the bar cannot overflow its track, while `over` keeps the fact
    // that it would have.
    percent: Math.min(100, Math.round((used / max) * 100)),
    exhausted: used >= max,
    over: used > max,
  }
}
