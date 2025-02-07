/**
 * Helper to get all relevant modifiers from effects
 * @todo Should we account for more than just addition?
 * @param {any} actorData - The system object of the actor to get modifiers
 * of.
 * @param {string} key - The active effect key to look up and apply.
 * @returns {number} The modifier.
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
