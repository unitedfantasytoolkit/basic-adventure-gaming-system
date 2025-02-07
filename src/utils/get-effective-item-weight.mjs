/**
 * Helper to calculate effective weight of an item considering containers
 * @param {Item} item - The Item to get the weight of.
 * @param {any} actorData - The system object of the actor who owns the item.
 * @returns {number} The weight of the Item.
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
