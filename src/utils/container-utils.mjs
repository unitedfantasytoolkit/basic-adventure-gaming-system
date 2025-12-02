/**
 * @file Utility functions for managing container relationships between items.
 * Containers can hold other items, and items can be stored in containers.
 * These utilities handle adding, removing, and querying container contents.
 */

/**
 * Add an item to a container's contains array.
 * Does not perform validation - that should be done before calling this.
 * Treats the contains array as a Set - won't add duplicates.
 * @param {Item} item - The item to add to the container
 * @param {Item} container - The container to add the item to
 * @returns {Promise<Item|undefined>} The updated container, or undefined if already present
 */
export async function addItemToContainer(item, container) {
  if (!container.system.container?.isContainer) {
    throw new Error("Target item is not a container")
  }

  const currentContains = container.system.container.contains || []

  // Only add if not already in the container (treat as a Set)
  if (currentContains.includes(item.uuid)) {
    return undefined // Already in container, no-op
  }

  const contains = [...currentContains, item.uuid]
  return container.update({ "system.container.contains": contains })
}

/**
 * Get the container that holds this item.
 * Returns null if the item is not in any container.
 * @param {Item} item - The item to find the container for
 * @returns {Item|null} The parent container, or null if not in a container
 */
export function getParentContainer(item) {
  if (!item.actor) return null

  return (
    item.actor.items.find((i) =>
      i.system.container?.contains?.includes(item.uuid),
    ) || null
  )
}

/**
 * Remove an item from its parent container.
 * If the item is not in a container, this is a no-op.
 * @param {Item} item - The item to remove from its container
 * @returns {Promise<Item|null>} The updated container, or null if no container
 */
export async function removeItemFromContainer(item) {
  const container = getParentContainer(item)
  if (!container) return null

  const contains = (container.system.container.contains || []).filter(
    (uuid) => uuid !== item.uuid,
  )
  return container.update({ "system.container.contains": contains })
}

/**
 * Get all items contained within a container.
 * Automatically filters out invalid/deleted items.
 * @param {Item} container - The container item
 * @returns {Item[]} Array of items in the container
 */
export function getContainerContents(container) {
  if (!container.system.container?.isContainer || !container.actor) {
    return []
  }

  const { actor } = container
  const uuids = container.system.container.contains || []

  return uuids
    .map((uuid) => fromUuidSync(uuid))
    .filter((item) => item && item.actor === actor)
}

/**
 * Check if an item is currently stored in a container.
 * @param {Item} item - The item to check
 * @returns {boolean} True if the item is in a container
 */
export function isItemInContainer(item) {
  return getParentContainer(item) !== null
}

/**
 * Validate and clean an array of container UUIDs.
 * Removes UUIDs that don't resolve to valid items in the same actor.
 * @param {string[]} uuids - Array of item UUIDs to validate
 * @param {Actor} actor - The actor that should own all items
 * @returns {Promise<string[]>} Filtered array of valid UUIDs
 */
export async function cleanContainerRefs(uuids, actor) {
  const valid = []

  for (const uuid of uuids || []) {
    const item = await fromUuid(uuid)
    if (item && item.actor === actor) {
      valid.push(uuid)
    }
  }

  return valid
}

/**
 * Check if adding an item to a container would create a circular reference.
 * Prevents scenarios like "backpack contains chest contains backpack".
 * @param {Item} item - The item to potentially add
 * @param {Item} container - The container to add it to
 * @returns {boolean} True if this would create a circular reference
 */
export function wouldCreateCircularRef(item, container) {
  if (!item.system.container?.isContainer) return false

  // Walk up the container chain from the target container
  let current = container
  while (current) {
    if (current.uuid === item.uuid) return true
    current = getParentContainer(current)
  }

  return false
}

// === Validation Functions ====================================================

/**
 * Validate whether an item can be added to a container.
 * Throws an error with a localized message if validation fails.
 * @param {Item} item - The item to add
 * @param {Item} container - The container to add to
 * @throws {Error} If validation fails, with localized error message
 */
export function validateAddToContainer(item, container) {
  // Check if target is a container
  if (!container.system.container?.isContainer) {
    throw new Error(
      game.i18n.format("BAGS.Items.Physical.Container.NotAContainer", {
        container: container.name,
      }),
    )
  }

  // Check same actor
  if (item.actor !== container.actor) {
    throw new Error(
      game.i18n.localize("BAGS.Items.Physical.Container.CrossActor"),
    )
  }

  // Check self-containment
  if (item.id === container.id) {
    throw new Error(
      game.i18n.localize("BAGS.Items.Physical.Container.SelfContainment"),
    )
  }

  // Check circular reference
  if (wouldCreateCircularRef(item, container)) {
    throw new Error(
      game.i18n.format("BAGS.Items.Physical.Container.CircularReference", {
        item: item.name,
        container: container.name,
      }),
    )
  }

  // Check weight capacity (only if max weight is set)
  if (container.system.container.weightMax > 0) {
    const currentWeight = container.system.contentsWeight
    const maxWeight = container.system.container.weightMax

    // Calculate item weight inline to avoid circular dependency
    let itemWeight = item.system.weight * item.system.quantity
    if (item.system.container?.isContainer) {
      itemWeight += item.system.contentsWeight
    }

    if (currentWeight + itemWeight > maxWeight) {
      throw new Error(
        game.i18n.format("BAGS.Items.Physical.Container.OverCapacity", {
          item: item.name,
          container: container.name,
          current: Math.round(currentWeight + itemWeight),
          max: maxWeight,
        }),
      )
    }
  }
}
