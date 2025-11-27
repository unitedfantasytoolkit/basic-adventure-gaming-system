/**
 * @file Sums all Active Effect modifiers for a specific stat.
 * When multiple effects modify the same stat (like AC or attack bonus), this
 * helper adds them all up to get the total modifier.
 */

/**
 * Finds and sums all Active Effect changes affecting a specific data path.
 * Currently only handles additive effects (mode ADD). Returns null if no effects
 * are found, making it easy to check if a stat is modified.
 * @todo Should we account for more than just addition? (multiply, override, etc.)
 * @param {object} actorData - The actor's system data object
 * @param {string} key - The data path to look for (e.g., "system.base.ac", "system.hp.max")
 * @returns {number|null} Total modifier from all effects, or null if no effects found
 * @example
 * // Actor has +2 AC from Shield spell and +1 AC from Ring of Protection
 * getModifiersOfKey(actorData, "system.base.ac")  // Returns 3
 */
export default (actorData, key) => {
  const applicableEffects = actorData.parent.effects.filter((e) =>
    e.changes.some((c) => c.key === key),
  )

  const sumEffects = (total, effect) =>
    total +
    effect.changes
      .filter((c) => c.key === key)
      .reduce((sum, change) => sum + Number(change.value), 0)

  return !applicableEffects.length
    ? null
    : applicableEffects.reduce(sumEffects, 0)
}
