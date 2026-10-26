/**
 * @file The Advanced games' rules for learning arcane spells.
 *
 * Both Advanced editions gate a magic-user's spellbook on Intelligence: a
 * percentage chance to learn any given spell, and a cap on how many spells they
 * may know at each spell level. Keeping the table here means the core system
 * never has to know that percentile spell learning exists -- a Basic world's
 * rules module simply doesn't have one.
 * @todo The percentages are transcribed from the Advanced 2nd Edition
 * Intelligence table and used for both Advanced modules, whose tables agree
 * closely enough for play. Worth checking against your own books before this
 * decides anything at the table.
 */

/**
 * @typedef {import('../utils/spell-learning.mjs').SpellLearningLimits} SpellLearningLimits
 */

/**
 * Intelligence to spell learning limits.
 *
 * Scores below 9 are absent on purpose: a caster who can't reach the bottom of
 * the table can't learn spells at all. `maxPerLevel` of null means no limit,
 * which is what the highest scores buy.
 * @type {Map<number, SpellLearningLimits>}
 */
export const arcaneLearningByIntelligence = new Map([
  [9, { chance: 35, maxPerLevel: 6 }],
  [10, { chance: 35, maxPerLevel: 7 }],
  [11, { chance: 40, maxPerLevel: 7 }],
  [12, { chance: 40, maxPerLevel: 7 }],
  [13, { chance: 45, maxPerLevel: 9 }],
  [14, { chance: 45, maxPerLevel: 9 }],
  [15, { chance: 50, maxPerLevel: 11 }],
  [16, { chance: 50, maxPerLevel: 11 }],
  [17, { chance: 55, maxPerLevel: 14 }],
  [18, { chance: 65, maxPerLevel: 18 }],
  [19, { chance: 70, maxPerLevel: null }],
  [20, { chance: 75, maxPerLevel: null }],
  [21, { chance: 80, maxPerLevel: null }],
  [22, { chance: 85, maxPerLevel: null }],
  [23, { chance: 90, maxPerLevel: null }],
  [24, { chance: 95, maxPerLevel: null }],
  [25, { chance: 100, maxPerLevel: null }],
])

/**
 * The ability score arcane casters learn from.
 * @type {string}
 */
export const ARCANE_LEARNING_ABILITY = "int"

export default arcaneLearningByIntelligence
