/**
 * @file Pure helper logic for character creation.
 *
 * Everything here works on plain objects and never touches Foundry globals, so
 * the rules that decide which steps appear, whether a class is a legal choice,
 * and how much money a character starts with can all be unit tested from the
 * command line.
 */

/**
 * @typedef {object} CreationSources
 * @property {Array} [classes] - Sources supplying class Items
 * @property {Array} [equipment] - Sources supplying purchasable Items
 * @property {Array} [identity] - Sources supplying ancestry/identity Items
 * @property {Array} [spells] - Sources supplying spell Items
 * @property {Array} [abilities] - Sources supplying ability Items
 */

/**
 * The order steps appear in. `scores` and `details` always appear; the rest are
 * added only when the game has data to fill them.
 * @type {string[]}
 */
export const STEP_ORDER = [
  "scores",
  "identity",
  "class",
  "abilities",
  "spells",
  "equipment",
  "details",
]

/**
 * Which source category each optional step depends on. A step whose category
 * has no configured sources is skipped entirely, so a game that doesn't use
 * ancestries never sees an ancestry step.
 * @type {Record<string, string>}
 */
const STEP_SOURCE_CATEGORY = {
  identity: "identity",
  class: "classes",
  abilities: "abilities",
  spells: "spells",
  equipment: "equipment",
}

/**
 * Get how many spells of each spell level a class can prepare at first level.
 *
 * A class stores `spellSlots` as `[spellLevel][characterLevel]`, so the first
 * level column is index 0 of each row.
 * @param {object|null} classItem - The class Item to inspect
 * @returns {number[]} Slot counts indexed by spell level, empty for non-casters
 */
export function getFirstLevelSpellSlots(classItem) {
  const slots = classItem?.system?.spellSlots
  if (!Array.isArray(slots)) return []

  return slots.map((perLevel) =>
    Array.isArray(perLevel) ? perLevel[0] || 0 : 0,
  )
}

/**
 * Work out which creation steps should be shown.
 *
 * The spell step is special: it needs both configured spell sources *and* a
 * chosen class that can actually cast at first level. A Fighter shouldn't be
 * asked to pick spells even in a game full of spell compendiums.
 * @param {CreationSources} sources - The configured creation sources
 * @param {object|null} selectedClass - The chosen class Item, if any
 * @returns {string[]} Step IDs, in display order
 */
export function getActiveSteps(sources, selectedClass = null) {
  const configured = sources || {}

  return STEP_ORDER.filter((step) => {
    if (step === "scores" || step === "details") return true

    const category = STEP_SOURCE_CATEGORY[step]
    if (!configured[category]?.length) return false

    // Only offer spells to a class that gets slots at level 1.
    if (step === "spells")
      return getFirstLevelSpellSlots(selectedClass).some(Boolean)

    return true
  })
}

/**
 * Decide which dice formula to roll for a character's starting money.
 *
 * B/X gives every character the same roll, which lives in the world setting.
 * AD&D-style games vary it per class, so a formula on the class wins when it's
 * set. A blank or whitespace-only class formula falls back to the world value.
 * @param {object|null} classItem - The chosen class Item, if any
 * @param {string} worldFormula - The world's default formula
 * @returns {string} The formula to roll
 */
export function resolveStartingGoldFormula(classItem, worldFormula) {
  const classFormula = classItem?.system?.startingGold

  if (typeof classFormula === "string" && classFormula.trim())
    return classFormula.trim()

  return worldFormula
}

/**
 * Build the dice formula for a first level character's hit points.
 *
 * The class's first XP table row describes the hit dice: how many to roll, a
 * flat modifier, and whether Constitution applies. A class that opts out of the
 * Constitution bonus (some ancestry classes do) ignores `conModifier`.
 *
 * Returns null for a class with no hit dice configured, so callers can leave
 * hit points alone rather than writing a zero.
 * @param {object|null} classItem - The chosen class Item
 * @param {number} conModifier - The character's Constitution hit point bonus
 * @returns {string|null} A dice formula, or null when there's nothing to roll
 */
export function buildStartingHitPointsFormula(classItem, conModifier = 0) {
  const system = classItem?.system
  const hitDieSize = system?.hitDieSize
  const hitDice = system?.xpTable?.[0]?.hd

  if (!hitDieSize || !hitDice) return null

  const count = hitDice.count || 1
  const flat = hitDice.modifier || 0
  const con = hitDice.canUseConMod ? conModifier || 0 : 0
  const bonus = flat + con

  if (!bonus) return `${count}d${hitDieSize}`

  return `${count}d${hitDieSize} ${bonus > 0 ? "+" : "-"} ${Math.abs(bonus)}`
}

/**
 * Check a set of ability score minimums against a character's rolled scores.
 *
 * A missing or zero requirement is treated as "no requirement", which is how
 * the class and identity schemas represent an unset prerequisite.
 * @param {Record<string, number>} prerequisites - Minimum scores by ability key
 * @param {Record<string, number>} abilityScores - The character's rolled scores
 * @returns {boolean} Whether every requirement is met
 */
export function meetsPrerequisites(prerequisites, abilityScores) {
  const required = prerequisites || {}
  const scores = abilityScores || {}

  return Object.entries(required)
    .filter(([, minimum]) => typeof minimum === "number" && minimum > 0)
    .every(([key, minimum]) => (scores[key] || 0) >= minimum)
}

/**
 * Score a single prime requisite group.
 *
 * The group's `isAnd` flag decides whether every score must be met or just one,
 * mirroring how the class sheet presents them.
 * @param {object} requisites - A prime requisite group, including `isAnd`
 * @param {Record<string, number>} abilityScores - The character's rolled scores
 * @returns {number} 0 when unmet or unset, 1 when met
 */
function scoreRequisiteGroup(requisites, abilityScores) {
  if (!requisites) return 0

  const { isAnd = true, ...minimums } = requisites
  const scores = abilityScores || {}

  const active = Object.entries(minimums).filter(
    ([, minimum]) => typeof minimum === "number" && minimum > 0,
  )
  if (!active.length) return 0

  const isMet = ([key, minimum]) => (scores[key] || 0) >= minimum

  return (isAnd ? active.every(isMet) : active.some(isMet)) ? 1 : 0
}

/**
 * Score how well a character's scores suit a class, for sorting suggestions.
 *
 * Returns -1 when the character can't take the class at all, so callers can
 * separate "illegal" from "legal but a poor fit". Higher is better.
 * @param {object} classItem - The class Item to score
 * @param {Record<string, number>} abilityScores - The character's rolled scores
 * @returns {number} -1 if prerequisites fail, otherwise a fit score from 0 up
 */
export function scoreClassFit(classItem, abilityScores) {
  if (!meetsPrerequisites(classItem?.system?.prerequisites, abilityScores))
    return -1

  // Prime requisites are the scores a class rewards with an XP bonus, so
  // meeting them is the clearest signal that a class suits these rolls.
  // Full prime requisites count double, since they're the harder bar.
  return (
    scoreRequisiteGroup(classItem?.system?.fullPrimeRequisites, abilityScores) *
      2 +
    scoreRequisiteGroup(classItem?.system?.halfPrimeRequisites, abilityScores)
  )
}

/**
 * Add up what's in the shopping cart.
 * @param {Array<{cost: number, quantity: number}>} cart - The cart entries
 * @returns {number} Total cost
 */
export function calculateCartTotal(cart) {
  if (!Array.isArray(cart)) return 0

  return cart.reduce(
    (total, entry) => total + (entry?.cost || 0) * (entry?.quantity || 0),
    0,
  )
}

/**
 * Work out how much money is left after shopping.
 *
 * Clamped at zero so a rounding slip or an edited cart can never hand a
 * character negative money to carry around.
 * @param {number} startingGold - The rolled starting money
 * @param {Array} cart - The cart entries
 * @returns {number} Remaining money, never below zero
 */
export function calculateRemainingGold(startingGold, cart) {
  return Math.max(0, (startingGold || 0) - calculateCartTotal(cart))
}

/**
 * Add an item to a cart, merging with an existing entry for the same item.
 *
 * Returns a new array rather than mutating, so callers can hand the result
 * straight to a re-render without worrying about shared references.
 * @param {Array} cart - The current cart entries
 * @param {object} entry - The entry to add, with at least `uuid` and `quantity`
 * @returns {Array} A new cart
 */
export function addToCart(cart, entry) {
  const current = Array.isArray(cart) ? cart : []
  const quantity = entry?.quantity || 1

  if (!entry?.uuid) return current

  const existing = current.find((e) => e.uuid === entry.uuid)
  if (!existing) return [...current, { ...entry, quantity }]

  return current.map((e) =>
    e.uuid === entry.uuid ? { ...e, quantity: e.quantity + quantity } : e,
  )
}
