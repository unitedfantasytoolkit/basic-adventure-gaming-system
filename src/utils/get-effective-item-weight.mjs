/**
 * @file Calculates the actual carried weight of an item accounting for containers.
 * Items in magical bags or other containers may weigh less (or more!) than normal,
 * this helper applies those modifiers for accurate encumbrance calculation.
 */

/**
 * Calculates effective weight of an item considering quantity and container contents.
 * For containers, includes the weight of all contents (with modifiers already applied).
 * Parent container modifiers are NOT applied here - they're applied by the parent's contentsWeight getter.
 * @param {Item} item - The Item to calculate weight for
 * @param {object} actorData - The actor's system data object (unused but kept for backwards compatibility)
 * @returns {number} The effective weight
 * @example
 * // Item with quantity 5, weight 2 = 10 total
 * @example
 * // Container (Backpack) weighing 2 coins, holding 50 coins of items = 52 coins total
 */
export default (item, actorData) => {
  const { quantity } = item.system
  if (!quantity) return 0

  let { weight } = item.system

  // Add contents weight if this is a container
  // (contentsWeight already has this container's modifier applied)
  if (item.system.container?.isContainer) {
    weight += item.system.contentsWeight
  }

  const totalWeight = weight * quantity
  return totalWeight >= 0 ? totalWeight : 0
}
