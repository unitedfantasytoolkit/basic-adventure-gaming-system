/**
 * @file Calculates the actual carried weight of an item accounting for containers.
 * Items in magical bags or other containers may weigh less (or more!) than normal,
 * this helper applies those modifiers for accurate encumbrance calculation.
 */

/**
 * Calculates effective weight of an item considering quantity and container modifiers.
 * If an item is stored in a container (like a Bag of Holding), the container's
 * weight modifier is applied. This ensures encumbrance is calculated correctly.
 * @param {Item} item - The Item to calculate weight for
 * @param {object} actorData - The actor's system data object
 * @returns {number} The effective weight after applying quantity and container modifiers
 * @example
 * // Item with quantity 5, weight 2 = 10 total
 * // If in Bag of Holding with 0.1 modifier = 1 total
 */
export default (item, actorData) => {
  const { quantity } = item.system
  if (!quantity) return 0

  let { weight } = item.system

  // Apply container modifiers if item is in a container
  if (item.system.container?.containerId) {
    const container = actorData.parent.items.get(
      item.system.container.containerId,
    )
    if (container?.system.container?.weightModifier) {
      weight *= container.system.container.weightModifier ?? 1
    }
  }

  const totalWeight = weight * quantity
  return totalWeight >= 0 ? totalWeight : 0
}
