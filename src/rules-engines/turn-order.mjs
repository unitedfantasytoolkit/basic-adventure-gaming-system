/**
 * @file The turn-ordering engine: given a set of combatants and a ruleset's
 * ordering configuration, work out who acts in what order.
 *
 * This module is pure. It takes plain objects, returns plain objects, and never
 * touches Foundry, the network, the clock, or a random number generator. That is
 * deliberate: turn order is where the rules risk lives, and keeping it pure means
 * every ruleset BAGS models can be tested without launching a game.
 *
 * The impure half of the job -- rolling dice, reading a combatant's declared
 * action, resolving a weapon's speed factor -- happens in the combat documents,
 * which reduce all of it to the plain numbers on an OrderableEntry before calling
 * in here. See docs/design/combat-turn-sequence.md, section 5.2.
 */

/**
 * One row of the turn order.
 *
 * There is exactly one entry per combatant, never one per group. Members of a
 * group share a `base` but can carry different `offset` values, so a per-group
 * array could not express the result.
 * @typedef {object} OrderableEntry
 * @property {string} combatantId - The combatant this row represents.
 * @property {string|null} groupId - The group that rolled for this combatant, or
 * null when the combatant rolled for itself.
 * @property {number|null} base - The unit's raw initiative roll. Null when the
 * unit has not rolled yet.
 * @property {number} offset - A per-combatant adjustment derived from the action
 * it declared. Always 0 in rulesets that have no such adjustments.
 * @property {number|null} [segment] - A position chosen outright, overriding
 * `base + offset`. AD&D's attack-spacing strategies need this: "first attack on
 * segment 1, second on segment 10" puts a fighter on segment 1 whatever their
 * side rolled, and no sum of a roll and an adjustment expresses that. Absent or
 * null in every ruleset that derives its ordering, which is most of them.
 * @property {number} phaseIndex - Which phase of its unit's turn this row acts
 * in. In B/X a side moves, then shoots, then casts, then fights hand to hand;
 * see `phaseIndexOf`. Always 0 in a ruleset without phases.
 * @property {number} stableIndex - The row's position before sorting, used as the
 * final tiebreak so that ordering is deterministic.
 */

/**
 * A ruleset's ordering configuration.
 * @typedef {object} TurnOrderConfig
 * @property {"high"|"low"} direction - Whether a high roll or a low roll acts
 * first. B/X and AD&D 1e are "high"; AD&D 2e is "low".
 * @property {boolean} perMemberOffsets - Whether members of one group can have
 * different offsets. Consumed by the combat tracker, not by `orderEntries` --
 * see the note on group contiguity below.
 */

/**
 * The directions a ruleset may declare. Exported so that configuration can be
 * validated somewhere that is allowed to complain, rather than having this
 * module guess quietly.
 * @type {readonly string[]}
 */
export const DIRECTIONS = Object.freeze(["high", "low"])

/**
 * What a ruleset gets when it declares nothing. These are B/X's rules, which are
 * the right answer for four of the five games BAGS models.
 * @type {TurnOrderConfig}
 */
export const DEFAULT_CONFIG = Object.freeze({
  direction: "high",
  perMemberOffsets: false,
})

/**
 * Identify the thing that rolled for this combatant.
 *
 * A grouped combatant's unit is its group. An ungrouped combatant is its own
 * unit. Keying on this rather than on `groupId` matters: two ungrouped
 * combatants both have a null `groupId`, and treating that as "the same unit"
 * would collapse an entire individual-initiative combat into a single turn.
 * @param {OrderableEntry} entry - The row to identify.
 * @returns {string} A key that is equal for two rows if and only if they rolled
 * together.
 */
export const unitKeyOf = (entry) => entry.groupId ?? entry.combatantId

/**
 * Work out the number a row is actually sorted by.
 *
 * A unit's roll is a base, not a final value: the combatant adds its own offset
 * on top. A unit that has not rolled has no effective initiative at all, which
 * is different from having rolled a zero.
 *
 * **An explicit `segment` wins over the sum, and counts as having a position
 * even when the unit's roll is missing.** A segment is not derived from a roll,
 * so a row that has one is placed regardless -- and a ruleset that assigns
 * segments without rolling is a coherent thing to build, even though none of the
 * ones shipped today does.
 * @param {OrderableEntry} entry - The row to score.
 * @returns {number|null} The effective initiative, or null if the row has no
 * position yet.
 */
export const effectiveInitiativeOf = (entry) => {
  if (Number.isFinite(entry.segment)) return entry.segment
  if (!Number.isFinite(entry.base)) return null
  return entry.base + (Number.isFinite(entry.offset) ? entry.offset : 0)
}

/**
 * Reduce a rules module to just the fields that affect ordering.
 *
 * Rules modules carry far more than this -- an id, a display name, a dice
 * formula, which unit rolls. None of that changes the sort, so none of it comes
 * in here. Anything unrecognised falls back to B/X's rules rather than throwing,
 * because a world with a mis-declared rules module should still be playable.
 * @param {object} [component] - A component from the INITIATIVE registry
 * category.
 * @returns {TurnOrderConfig} A configuration `orderEntries` can use.
 */
export const toTurnOrderConfig = (component) => ({
  direction: DIRECTIONS.includes(component?.direction)
    ? component.direction
    : DEFAULT_CONFIG.direction,
  perMemberOffsets: component?.perMemberOffsets === true,
})

/**
 * Find which phase a declared action falls in.
 *
 * A phase lists the declarations that act in it. Anything a ruleset's phases
 * do not mention -- no declaration at all, a delay, "something else" -- acts
 * after every phase, because a combatant who has not said what they are doing
 * cannot be placed in a step that depends on it.
 * @param {string|null} declarationId - The declared action's id, if any.
 * @param {Array<{declarations: string[]}>} [phases] - The ruleset's phases, in
 * the order they happen.
 * @returns {number} The phase's position, or `phases.length` for "after them
 * all". Always 0 when the ruleset has no phases.
 */
export const phaseIndexOf = (declarationId, phases = []) => {
  if (!phases.length) return 0
  const index = phases.findIndex((phase) =>
    phase.declarations?.includes(declarationId),
  )
  return index === -1 ? phases.length : index
}

/**
 * Compare two rows, returning the usual negative/zero/positive sort result.
 *
 * The comparison runs through four keys in order, falling through to the next
 * only when the current one ties:
 *
 * 1. **Effective initiative.** Unrolled units always sort last, whichever
 *    direction the ruleset reads in -- an unrolled combatant has not earned a
 *    place in the order, and under a low-acts-first ruleset the naive
 *    treatment would put it at the very front.
 * 2. **Unit.** Tied units are kept together, so a group's members do not
 *    interleave with another group's when both rolled the same number. This is
 *    a plain string comparison: arbitrary, but stable, which is all contiguity
 *    needs.
 * 3. **Phase.** Within one unit's turn, movers before shooters before casters
 *    before fighters. It comes *after* the unit on purpose: B/X plays every
 *    phase of the winning side's turn before the losing side begins, so a
 *    phase never reaches across sides. An earlier design put it first, which
 *    would have had both sides move before either shot.
 * 4. **Original position.** Guarantees a total order, so the same input always
 *    produces the same output.
 * @param {TurnOrderConfig} config - The ruleset's ordering configuration.
 * @returns {Function} A comparator suitable for `Array#sort`.
 */
const comparatorFor = (config) => (a, b) => {
  const scoreA = effectiveInitiativeOf(a)
  const scoreB = effectiveInitiativeOf(b)
  const aIsUnrolled = scoreA === null
  const bIsUnrolled = scoreB === null

  if (aIsUnrolled !== bIsUnrolled) return aIsUnrolled ? 1 : -1

  if (!aIsUnrolled && scoreA !== scoreB) {
    return config.direction === "high" ? scoreB - scoreA : scoreA - scoreB
  }

  const unitA = unitKeyOf(a)
  const unitB = unitKeyOf(b)
  if (unitA !== unitB) return unitA < unitB ? -1 : 1

  const phaseA = a.phaseIndex ?? 0
  const phaseB = b.phaseIndex ?? 0
  if (phaseA !== phaseB) return phaseA - phaseB

  return a.stableIndex - b.stableIndex
}

/**
 * Sort a set of rows into the order their combatants act in.
 *
 * The input array is not modified.
 *
 * A note on group contiguity: this function keeps tied units together, but that
 * only adds up to "every group renders as one contiguous block" when the ruleset
 * gives every member of a group the same offset. Once offsets differ, members of
 * one group legitimately land on either side of another group's members -- in
 * AD&D 1e a caster's spell going off later than their allies' sword swings is
 * the rule working, not a sorting bug. That is why `perMemberOffsets` exists: the
 * tracker reads it to decide whether it may draw group blocks at all.
 * @param {OrderableEntry[]} entries - The rows to sort, one per combatant.
 * @param {TurnOrderConfig} [config] - The ruleset's ordering configuration.
 * Defaults to B/X's rules. Passed through `toTurnOrderConfig`, which is
 * idempotent, so an already-normalised config survives unchanged and a partial
 * or malformed one is filled in rather than producing an undefined direction.
 * @returns {OrderableEntry[]} A new array, sorted into turn order.
 */
export const orderEntries = (entries, config) =>
  [...entries].sort(comparatorFor(toTurnOrderConfig(config)))
