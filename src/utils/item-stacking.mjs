/**
 * @file Utilities for determining if items can stack and merging item stacks.
 */

/**
 * Determine if two items can be stacked together.
 * 
 * Items can stack if they share the same base identity and are not in special
 * states that make them unique (equipped, enchanted, partially used, etc.).
 * 
 * This is used when dropping items on actors, transferring between actors, or
 * placing items in containers to determine if the items should be merged.
 * 
 * @param {Item} itemA - First item to compare
 * @param {Item} itemB - Second item to compare
 * @returns {boolean} True if items can be stacked together
 */
export function canItemsStack(itemA, itemB) {
  // Items must both be physical items
  if (!itemA.system.isPhysicalItem || !itemB.system.isPhysicalItem) {
    return false
  }

  // Check hard exclusions - states that make items unique
  if (!passesStackingExclusions(itemA) || !passesStackingExclusions(itemB)) {
    return false
  }

  // Check if XP tracking state differs
  if (
    itemA.system.hasBeenCountedAsTreasure !==
    itemB.system.hasBeenCountedAsTreasure
  ) {
    return false
  }

  // Check if items have the same identity
  return haveSameIdentity(itemA, itemB)
}

/**
 * Check if an item passes all stacking exclusions (not in a "unique" state).
 * 
 * Items in these states are considered unique and cannot be stacked:
 * - Containers (never stack regardless of contents)
 * - Unidentified items (prevents information leakage)
 * - Equipped items (can't have multiple equipped)
 * - Items with active effects (enchanted/modified)
 * - Partially depleted items (used items are separate)
 * - Items explicitly marked as non-stackable
 * 
 * @param {Item} item - The item to check
 * @returns {boolean} True if item can potentially stack
 * @private
 */
function passesStackingExclusions(item) {
  const sys = item.system

  // Containers never stack
  if (sys.container?.isContainer) return false

  // Unidentified items never stack (prevents info leakage)
  if (!sys.identification?.isIdentified) return false

  // Equipped items don't stack
  if (sys.isEquipped) return false

  // Items with active effects are unique
  if (item.effects?.size > 0) return false

  // Partially depleted items don't stack
  if (sys.uses?.max > 0 && sys.uses.value < sys.uses.max) return false

  // Respect explicit stackable flag
  if (sys.isStackable === false) return false

  return true
}

/**
 * Check if two items have the same base identity.
 * 
 * Items are considered to have the same identity if they match on all
 * properties that define "what this item is" rather than "what state it's in".
 * 
 * Items without a baseItemId are treated as unique - they cannot stack with
 * anything, even if properties match. This ensures items don't accidentally
 * merge when they shouldn't.
 * 
 * Note: We intentionally skip deep action comparison for performance reasons.
 * Actions are complex nested structures. Instead, we rely on baseItemId and
 * basic property matching. If items have different actions but the same
 * baseItemId, they likely represent different versions/modifications and
 * shouldn't stack anyway.
 * 
 * @param {Item} itemA - First item to compare
 * @param {Item} itemB - Second item to compare
 * @returns {boolean} True if items have the same identity
 * @private
 */
function haveSameIdentity(itemA, itemB) {
  const sysA = itemA.system
  const sysB = itemB.system

  // Name must match exactly (renamed items are unique)
  if (itemA.name !== itemB.name) return false

  // Type must match
  if (itemA.type !== itemB.type) return false

  // Both items MUST have a baseItemId to be stackable
  // Items without baseItemId are treated as unique
  if (!sysA.baseItemId || !sysB.baseItemId) return false

  // Base item ID must match
  if (sysA.baseItemId !== sysB.baseItemId) return false

  // Core properties must match
  if (sysA.cost !== sysB.cost) return false
  if (sysA.weight !== sysB.weight) return false
  if (sysA.uses?.max !== sysB.uses?.max) return false
  if (sysA.countsAsTreasure !== sysB.countsAsTreasure) return false

  // If we got here, items are identical enough to stack
  return true
}

/**
 * Find all items in an actor's inventory that can stack with the given item.
 * 
 * @param {Item} item - The item to find matches for
 * @param {Actor} actor - The actor whose inventory to search
 * @returns {Item[]} Array of items that can stack with the given item
 */
export function findStackableMatches(item, actor) {
  if (!item.system.isPhysicalItem) return []

  return actor.items.filter((existing) => {
    // Don't match with itself
    if (existing.id === item.id) return false

    return canItemsStack(item, existing)
  })
}

/**
 * Merge two item stacks by transferring quantity from source to target.
 * 
 * This increases the target's quantity and can optionally delete the source.
 * Both items must be stackable with each other for this to work safely.
 * 
 * @param {Item} targetItem - The item to merge into (keeps existing)
 * @param {Item} sourceItem - The item to merge from (will be deleted if deleteSource is true)
 * @param {object} options - Merge options
 * @param {boolean} [options.deleteSource=true] - Whether to delete the source item after merging
 * @returns {Promise<Item>} The updated target item
 */
export async function mergeItemStacks(
  targetItem,
  sourceItem,
  { deleteSource = true } = {},
) {
  if (!canItemsStack(targetItem, sourceItem)) {
    throw new Error(
      `Cannot merge items: ${targetItem.name} and ${sourceItem.name} are not stackable`,
    )
  }

  const newQuantity = targetItem.system.quantity + sourceItem.system.quantity

  await targetItem.update({ "system.quantity": newQuantity })

  if (deleteSource) {
    await sourceItem.delete()
  }

  return targetItem
}

/**
 * Split an item stack into two stacks.
 * 
 * Creates a new item with the specified quantity and reduces the original
 * item's quantity accordingly.
 * 
 * @param {Item} item - The item to split
 * @param {number} splitQuantity - How many to split off (must be less than item's quantity)
 * @returns {Promise<Item>} The newly created item with the split quantity
 */
export async function splitItemStack(item, splitQuantity) {
  if (!item.system.isPhysicalItem) {
    throw new Error(`Cannot split non-physical item: ${item.name}`)
  }

  if (splitQuantity <= 0 || splitQuantity >= item.system.quantity) {
    throw new Error(
      `Invalid split quantity: ${splitQuantity} (item has ${item.system.quantity})`,
    )
  }

  const newQuantity = item.system.quantity - splitQuantity

  // Create new item with split quantity
  const newItemData = item.toObject()
  newItemData.system.quantity = splitQuantity

  const [newItem] = await item.parent.createEmbeddedDocuments("Item", [
    newItemData,
  ])

  // Update original item's quantity
  await item.update({ "system.quantity": newQuantity })

  return newItem
}
