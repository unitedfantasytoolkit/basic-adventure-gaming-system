/**
 * @file The arithmetic behind learning a spell.
 *
 * The rules modules own the tables and the dice; this file owns the parts that
 * are the same wherever those tables come from, so they can be tested without a
 * running Foundry.
 */

/**
 * What a caster's ability score buys them when learning spells.
 * @typedef SpellLearningLimits
 * @property {number} chance - Percent chance to learn any one spell
 * @property {number|null} maxPerLevel - How many spells they may know at each
 * spell level, or null for no limit
 */

/**
 * Read a learning table at a given ability score.
 *
 * Tables are sparse -- they start at the lowest score that can cast at all --
 * so a score below the table's floor means "cannot learn spells", and a score
 * above its ceiling gets the best row.
 * @param {Map<number, SpellLearningLimits>} table - Score to limits
 * @param {number} score - The caster's ability score
 * @returns {SpellLearningLimits|null} The matching row, or null if the score is
 * too low to learn anything
 */
export function learningLimitsForScore(table, score) {
  if (!table?.size || !Number.isFinite(score)) return null

  const scores = Array.from(table.keys()).sort((a, b) => a - b)
  const lowest = scores[0]

  if (score < lowest) return null

  // Walk up to the highest row the score reaches. A score above the table's
  // top -- a wizard with an 18 in a table that stops at 17 -- gets the top row.
  const matched = scores.reduce(
    (best, candidate) => (score >= candidate ? candidate : best),
    lowest,
  )

  return table.get(matched)
}

/**
 * Whether a class can cast spells of a given level yet.
 *
 * A class's slots are indexed by spell level, so a first-level magic-user has a
 * count at index 0 and nothing beyond it. No count means no spells of that
 * level, which is what stops a beginner from learning a fireball.
 * @param {number[]} slots - Slot counts by spell level, index 0 being level 1
 * @param {number} spellLevel - The spell level being checked
 * @returns {boolean} True when the class has at least one slot at that level
 */
export function hasSlotsAtLevel(slots, spellLevel) {
  if (!Array.isArray(slots) || !spellLevel) return false
  return (slots[spellLevel - 1] || 0) > 0
}

/**
 * Whether a caster has room for another spell at a given level.
 * @param {number} known - How many spells of that level the caster already has
 * @param {number|null} maxPerLevel - The cap, or null for no cap
 * @returns {boolean} True when another spell would fit
 */
export function hasRoomToLearn(known, maxPerLevel) {
  if (maxPerLevel === null || maxPerLevel === undefined) return true
  return known < maxPerLevel
}
