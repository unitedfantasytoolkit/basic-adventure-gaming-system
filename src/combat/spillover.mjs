/**
 * @file Spillover: a spell begun late enough in a round that it goes off in
 * the next one.
 *
 * In the Advanced games a seven-segment spell begun on segment 6 goes off on
 * segment 3 of the *following* round, and its caster spends the rest of this
 * round -- and the start of the next -- still casting. Within the round the
 * spell sorts last, as it always has. When the round closes, where it really
 * lands is carried forward, and in the next round the caster is placed on that
 * segment whatever their side rolls.
 *
 * The arithmetic is `overflowOf` in `src/rules-engines/segments.mjs`. This file
 * is where the carried segments are stored and read.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import { overflowOf } from "../rules-engines/segments.mjs"

/**
 * The combat flag listing carried actions: `{_id, round, segment}` each.
 *
 * `round` is the round the action lands in, and `segment` is where in it --
 * unclamped, so that an action long enough to run past *that* round too can be
 * carried again. A list rather than an object keyed by id, because a flag
 * update merges objects and replaces lists, and every close writes a fresh one.
 * @type {string}
 */
export const CARRY_FLAG = "carry"

/**
 * The segment a combatant's action was carried to, in the current round.
 *
 * Reached from data preparation, which is why it reads the flag object
 * directly and is a plain function rather than a private method. See
 * `baseRollFor` in `combatant.document.mjs`.
 * @param {Combatant} combatant - The combatant to look up.
 * @returns {number|null} The carried segment, unclamped, or null when nothing
 * was carried into this round for them.
 */
export const carriedSegmentFor = (combatant) => {
  const combat = combatant?.parent
  const carried = combat?.flags?.[SYSTEM_NAME]?.[CARRY_FLAG]
  if (!Array.isArray(carried)) return null

  const entry = carried.find(
    (carry) => carry._id === combatant.id && carry.round === combat.round,
  )
  return Number.isFinite(entry?.segment) ? entry.segment : null
}

/**
 * Where a combatant's action lands, before it is kept inside the round.
 * @param {Combatant} combatant - The combatant.
 * @param {number|null} base - Their unit's roll.
 * @param {number} declaredOffset - What their declaration adds to it.
 * @returns {number|null} The segment, or null when nothing places them.
 */
export const rawSegmentFor = (combatant, base, declaredOffset) => {
  const carried = carriedSegmentFor(combatant)
  if (carried !== null) return carried
  if (base === null) return null
  return base + declaredOffset
}

/**
 * Where a combatant's action spills into the next round, if it does.
 *
 * Only for a declaration the ruleset says can carry over. Surprise is left
 * out: segments lost to surprise are lost from the first round, not owed in
 * the second.
 * @param {Combatant} combatant - The combatant.
 * @param {number|null} raw - From `rawSegmentFor`.
 * @returns {{round: number, segment: number}|null} Where it lands, or null.
 */
export const spilloverFor = (combatant, raw) => {
  const combat = combatant?.parent
  const config = combat?.initiativeConfig
  if (!config?.carriesOver?.includes(combatant.declarationType?.id)) {
    return null
  }

  const segment = overflowOf(raw, config.roundLength)
  if (!segment) return null
  return { round: (combat.round ?? 0) + 1, segment }
}

/**
 * Work out every action to carry out of the round now closing.
 * @param {Combat} combat - The encounter.
 * @returns {object[]} `{_id, round, segment}` per combatant still mid-action.
 */
export const carriesOutOf = (combat) =>
  combat.combatants
    .map((combatant) => ({ combatant, spill: combatant.spillover }))
    .filter(({ spill }) => spill)
    .map(({ combatant, spill }) => ({ _id: combatant.id, ...spill }))
