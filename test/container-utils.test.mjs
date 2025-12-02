/**
 * @file Tests for container utility functions
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  getParentContainer,
  getContainerContents,
  isItemInContainer,
  wouldCreateCircularRef,
  addItemToContainer,
} from "../src/utils/container-utils.mjs"

// === Test Helpers ============================================================

/**
 * Create a mock item for testing
 */
function createMockItem(overrides = {}) {
  const id = overrides.id || `item-${Math.random().toString(36).substring(7)}`
  const uuid = overrides.uuid || `Actor.actor-123.Item.${id}`

  return {
    id,
    uuid,
    name: overrides.name || "Test Item",
    type: overrides.type || "item",
    actor: overrides.actor || null,
    system: {
      isPhysicalItem: true,
      container: {
        isContainer: false,
        contains: [],
        weightMax: 0,
        weightModifier: 1,
        ...overrides.container,
      },
      ...overrides.system,
    },
  }
}

/**
 * Create a mock actor with items
 */
function createMockActor(items = []) {
  const actor = {
    id: "actor-123",
    items: {
      find: (predicate) => items.find(predicate),
      filter: (predicate) => items.filter(predicate),
    },
  }

  // Link items to actor
  items.forEach((item) => {
    item.actor = actor
  })

  return actor
}

/**
 * Mock fromUuidSync for testing
 * In real code, Foundry provides this globally
 */
globalThis.fromUuidSync = function (uuid) {
  // Extract item ID from UUID format: Actor.actorId.Item.itemId
  const match = uuid.match(/Item\.([^.]+)$/)
  if (!match) return null

  const itemId = match[1]

  // Look through all items we've created in tests
  // This is a simplified mock - in real Foundry, this queries the world
  if (globalThis._testItems) {
    return globalThis._testItems.find((item) => item.id === itemId) || null
  }

  return null
}

// === Tests ===================================================================

test.before(() => {
  globalThis._testItems = []
})

test.after(() => {
  delete globalThis._testItems
})

// --- getParentContainer ------------------------------------------------------

test("getParentContainer: returns null when item has no actor", () => {
  const item = createMockItem()
  const result = getParentContainer(item)
  assert.is(result, null)
})

test("getParentContainer: returns null when item is not in any container", () => {
  const item = createMockItem({ id: "item-1" })
  const container = createMockItem({
    id: "container-1",
    container: { isContainer: true, contains: [] },
  })

  createMockActor([item, container])

  const result = getParentContainer(item)
  assert.is(result, null)
})

test("getParentContainer: finds the container that holds the item", () => {
  const item = createMockItem({ id: "item-1" })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item.uuid],
    },
  })

  createMockActor([item, container])

  const result = getParentContainer(item)
  assert.is(result, container)
})

test("getParentContainer: returns first container when item is in multiple (invalid state)", () => {
  const item = createMockItem({ id: "item-1" })
  const container1 = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item.uuid],
    },
  })
  const container2 = createMockItem({
    id: "container-2",
    container: {
      isContainer: true,
      contains: [item.uuid],
    },
  })

  createMockActor([item, container1, container2])

  const result = getParentContainer(item)
  // Should return the first one found (container1 or container2)
  assert.ok([container1, container2].includes(result))
})

// --- getContainerContents ----------------------------------------------------

test("getContainerContents: returns empty array for non-container", () => {
  const item = createMockItem({ container: { isContainer: false } })
  createMockActor([item])

  const result = getContainerContents(item)
  assert.equal(result, [])
})

test("getContainerContents: returns empty array when container has no actor", () => {
  const container = createMockItem({
    container: { isContainer: true, contains: [] },
  })

  const result = getContainerContents(container)
  assert.equal(result, [])
})

test("getContainerContents: returns items in the container", () => {
  const item1 = createMockItem({ id: "item-1" })
  const item2 = createMockItem({ id: "item-2" })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item1.uuid, item2.uuid],
    },
  })

  const actor = createMockActor([item1, item2, container])
  globalThis._testItems = [item1, item2, container]

  const result = getContainerContents(container)
  assert.equal(result, [item1, item2])
})

test("getContainerContents: filters out invalid UUIDs", () => {
  const item1 = createMockItem({ id: "item-1" })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item1.uuid, "Actor.actor-123.Item.deleted-item"],
    },
  })

  const actor = createMockActor([item1, container])
  globalThis._testItems = [item1, container]

  const result = getContainerContents(container)
  assert.equal(result, [item1])
})

test("getContainerContents: filters out items from different actors", () => {
  const item1 = createMockItem({ id: "item-1" })
  const otherActorItem = createMockItem({
    id: "item-2",
    uuid: "Actor.other-actor.Item.item-2",
  })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item1.uuid, otherActorItem.uuid],
    },
  })

  const actor = createMockActor([item1, container])
  globalThis._testItems = [item1, container, otherActorItem]

  const result = getContainerContents(container)
  // Should only include item1, not the other actor's item
  assert.equal(result, [item1])
})

// --- isItemInContainer -------------------------------------------------------

test("isItemInContainer: returns false when item has no actor", () => {
  const item = createMockItem()
  assert.is(isItemInContainer(item), false)
})

test("isItemInContainer: returns false when item is not in a container", () => {
  const item = createMockItem({ id: "item-1" })
  createMockActor([item])

  assert.is(isItemInContainer(item), false)
})

test("isItemInContainer: returns true when item is in a container", () => {
  const item = createMockItem({ id: "item-1" })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item.uuid],
    },
  })

  createMockActor([item, container])

  assert.is(isItemInContainer(item), true)
})

// --- wouldCreateCircularRef --------------------------------------------------

test("wouldCreateCircularRef: returns false when item is not a container", () => {
  const item = createMockItem({ container: { isContainer: false } })
  const container = createMockItem({
    container: { isContainer: true, contains: [] },
  })

  createMockActor([item, container])

  assert.is(wouldCreateCircularRef(item, container), false)
})

test("wouldCreateCircularRef: returns false when no circular reference exists", () => {
  const innerContainer = createMockItem({
    id: "inner",
    container: { isContainer: true, contains: [] },
  })
  const outerContainer = createMockItem({
    id: "outer",
    container: { isContainer: true, contains: [] },
  })

  createMockActor([innerContainer, outerContainer])

  assert.is(wouldCreateCircularRef(innerContainer, outerContainer), false)
})

test("wouldCreateCircularRef: detects direct circular reference (A contains B, B would contain A)", () => {
  const containerA = createMockItem({
    id: "container-a",
    container: { isContainer: true, contains: [] },
  })
  const containerB = createMockItem({
    id: "container-b",
    container: {
      isContainer: true,
      contains: [containerA.uuid],
    },
  })

  createMockActor([containerA, containerB])

  // Trying to put B into A would create: A contains B contains A
  assert.is(wouldCreateCircularRef(containerB, containerA), true)
})

test("wouldCreateCircularRef: detects indirect circular reference (A contains B contains C, C would contain A)", () => {
  const containerA = createMockItem({
    id: "container-a",
    container: { isContainer: true, contains: [] },
  })
  const containerB = createMockItem({
    id: "container-b",
    container: {
      isContainer: true,
      contains: [containerA.uuid],
    },
  })
  const containerC = createMockItem({
    id: "container-c",
    container: {
      isContainer: true,
      contains: [containerB.uuid],
    },
  })

  createMockActor([containerA, containerB, containerC])

  // Trying to put C into A would create: A contains C contains B contains A
  assert.is(wouldCreateCircularRef(containerC, containerA), true)
})

test("wouldCreateCircularRef: allows container to contain itself in edge case check", () => {
  const container = createMockItem({
    id: "container-1",
    container: { isContainer: true, contains: [] },
  })

  createMockActor([container])

  // Trying to put a container into itself
  assert.is(wouldCreateCircularRef(container, container), true)
})

// === addItemToContainer Tests ================================================

test("addItemToContainer: prevents duplicate entries (returns undefined)", async () => {
  const item = createMockItem({ id: "item-1" })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [item.uuid], // Item already in container
    },
  })

  // Track update calls
  let updateCalled = false
  container.update = async (data) => {
    updateCalled = true
    return container
  }

  const result = await addItemToContainer(item, container)

  // Should not call update if already in container
  assert.is(updateCalled, false)
  assert.is(result, undefined)
})

test("addItemToContainer: adds item when not already present", async () => {
  const item = createMockItem({ id: "item-1" })
  const container = createMockItem({
    id: "container-1",
    container: {
      isContainer: true,
      contains: [],
    },
  })

  let updatedData = null
  container.update = async (data) => {
    updatedData = data
    container.system.container.contains = data["system.container.contains"]
    return container
  }

  const result = await addItemToContainer(item, container)

  assert.ok(updatedData)
  assert.equal(updatedData["system.container.contains"], [item.uuid])
  assert.is(result, container)
})

test.run()
