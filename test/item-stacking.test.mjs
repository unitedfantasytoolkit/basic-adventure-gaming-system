/**
 * @file Tests for item stacking utilities
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  canItemsStack,
  findStackableMatches,
  mergeItemStacks,
  splitItemStack,
} from "../src/utils/item-stacking.mjs"

// === Test Helpers ============================================================

/**
 * Simple deep merge for test purposes (no Foundry dependency)
 */
function simpleMerge(target, source) {
  const result = { ...target }

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = simpleMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }

  return result
}

/**
 * Create a mock physical item for testing
 */
function createMockItem(overrides = {}) {
  const defaults = {
    id: `item-${Math.random().toString(36).substring(7)}`,
    name: "Test Item",
    type: "item",
    system: {
      isPhysicalItem: true,
      baseItemId: "base-123",
      isStackable: true,
      quantity: 1,
      cost: 10,
      weight: 1,
      uses: { value: 0, max: 0 },
      countsAsTreasure: false,
      hasBeenCountedAsTreasure: false,
      isEquipped: false,
      container: { isContainer: false },
      identification: { isIdentified: true },
    },
    effects: new Map(),
  }

  return simpleMerge(defaults, overrides)
}

/**
 * Create a mock actor for testing
 */
function createMockActor(items = []) {
  return {
    items,
    createEmbeddedDocuments: async (type, data) => {
      const newItems = data.map((d) => createMockItem(d))
      items.push(...newItems)
      return newItems
    },
  }
}

// === canItemsStack Tests =====================================================

test("canItemsStack: identical items should stack", () => {
  const itemA = createMockItem()
  const itemB = createMockItem({ id: "different-id" })

  assert.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: non-physical items should not stack", () => {
  const itemA = createMockItem()
  const itemB = createMockItem({
    id: "different-id",
    system: { isPhysicalItem: false },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: containers should never stack", () => {
  const itemA = createMockItem({
    system: { container: { isContainer: true } },
  })
  const itemB = createMockItem({
    id: "different-id",
    system: { container: { isContainer: true } },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: unidentified items should not stack", () => {
  const itemA = createMockItem({
    system: { identification: { isIdentified: false } },
  })
  const itemB = createMockItem({
    id: "different-id",
    system: { identification: { isIdentified: false } },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: equipped items should not stack", () => {
  const itemA = createMockItem({ system: { isEquipped: true } })
  const itemB = createMockItem({
    id: "different-id",
    system: { isEquipped: true },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with active effects should not stack", () => {
  const itemA = createMockItem()
  itemA.effects = new Map([["effect-1", {}]])
  const itemB = createMockItem({ id: "different-id" })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: partially depleted items should not stack", () => {
  const itemA = createMockItem({
    system: { uses: { value: 3, max: 6 } },
  })
  const itemB = createMockItem({
    id: "different-id",
    system: { uses: { value: 6, max: 6 } },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different XP tracking state should not stack", () => {
  const itemA = createMockItem({
    system: { hasBeenCountedAsTreasure: true },
  })
  const itemB = createMockItem({
    id: "different-id",
    system: { hasBeenCountedAsTreasure: false },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: explicitly non-stackable items should not stack", () => {
  const itemA = createMockItem({ system: { isStackable: false } })
  const itemB = createMockItem({
    id: "different-id",
    system: { isStackable: false },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different names should not stack", () => {
  const itemA = createMockItem({ name: "Torch" })
  const itemB = createMockItem({ id: "different-id", name: "Lucky Torch" })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different types should not stack", () => {
  const itemA = createMockItem({ type: "item" })
  const itemB = createMockItem({ id: "different-id", type: "weapon" })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different baseItemId should not stack", () => {
  const itemA = createMockItem({ system: { baseItemId: "base-123" } })
  const itemB = createMockItem({
    id: "different-id",
    system: { baseItemId: "base-456" },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different cost should not stack", () => {
  const itemA = createMockItem({ system: { cost: 10 } })
  const itemB = createMockItem({ id: "different-id", system: { cost: 20 } })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different weight should not stack", () => {
  const itemA = createMockItem({ system: { weight: 1 } })
  const itemB = createMockItem({ id: "different-id", system: { weight: 2 } })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different max uses should not stack", () => {
  const itemA = createMockItem({ system: { uses: { value: 6, max: 6 } } })
  const itemB = createMockItem({
    id: "different-id",
    system: { uses: { value: 10, max: 10 } },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with different treasure flag should not stack", () => {
  const itemA = createMockItem({ system: { countsAsTreasure: true } })
  const itemB = createMockItem({
    id: "different-id",
    system: { countsAsTreasure: false },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items with both null baseItemId should NOT stack (treated as unique)", () => {
  const itemA = createMockItem({ system: { baseItemId: null } })
  const itemB = createMockItem({
    id: "different-id",
    system: { baseItemId: null },
  })

  // Even though properties match, null baseItemId means unique items
  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: items where only one has baseItemId should not stack", () => {
  const itemA = createMockItem({ system: { baseItemId: "base-123" } })
  const itemB = createMockItem({
    id: "different-id",
    system: { baseItemId: null },
  })

  assert.not.ok(canItemsStack(itemA, itemB))
})

test("canItemsStack: different quantities should still stack", () => {
  const itemA = createMockItem({ system: { quantity: 5 } })
  const itemB = createMockItem({
    id: "different-id",
    system: { quantity: 10 },
  })

  assert.ok(canItemsStack(itemA, itemB))
})

// === findStackableMatches Tests ==============================================

test("findStackableMatches: finds matching items", () => {
  const item1 = createMockItem({ name: "Torch" })
  const item2 = createMockItem({ id: "item-2", name: "Torch" })
  const item3 = createMockItem({ id: "item-3", name: "Rope" })

  const actor = createMockActor([item2, item3])
  const matches = findStackableMatches(item1, actor)

  assert.is(matches.length, 1)
  assert.is(matches[0].id, "item-2")
})

test("findStackableMatches: excludes non-matching items", () => {
  const item1 = createMockItem({ name: "Torch" })
  const item2 = createMockItem({
    id: "item-2",
    name: "Torch",
    system: { isEquipped: true },
  })
  const item3 = createMockItem({ id: "item-3", name: "Rope" })

  const actor = createMockActor([item2, item3])
  const matches = findStackableMatches(item1, actor)

  assert.is(matches.length, 0)
})

test("findStackableMatches: excludes item from matching with itself", () => {
  const item1 = createMockItem({ name: "Torch" })
  const actor = createMockActor([item1])
  const matches = findStackableMatches(item1, actor)

  assert.is(matches.length, 0)
})

test("findStackableMatches: returns empty array for non-physical items", () => {
  const item1 = createMockItem({
    name: "Spell",
    system: { isPhysicalItem: false },
  })
  const item2 = createMockItem({
    id: "item-2",
    name: "Spell",
    system: { isPhysicalItem: false },
  })

  const actor = createMockActor([item2])
  const matches = findStackableMatches(item1, actor)

  assert.is(matches.length, 0)
})

// === mergeItemStacks Tests ===================================================

test("mergeItemStacks: combines quantities correctly", async () => {
  const target = createMockItem({ system: { quantity: 5 } })
  const source = createMockItem({
    id: "source",
    system: { quantity: 3 },
  })

  // Mock update and delete methods
  let updatedQuantity = null
  let sourceDeleted = false

  target.update = async (data) => {
    updatedQuantity = data["system.quantity"]
    target.system.quantity = updatedQuantity
  }
  source.delete = async () => {
    sourceDeleted = true
  }

  await mergeItemStacks(target, source)

  assert.is(updatedQuantity, 8)
  assert.ok(sourceDeleted)
})

test("mergeItemStacks: can preserve source item", async () => {
  const target = createMockItem({ system: { quantity: 5 } })
  const source = createMockItem({
    id: "source",
    system: { quantity: 3 },
  })

  let updatedQuantity = null
  let sourceDeleted = false

  target.update = async (data) => {
    updatedQuantity = data["system.quantity"]
    target.system.quantity = updatedQuantity
  }
  source.delete = async () => {
    sourceDeleted = true
  }

  await mergeItemStacks(target, source, { deleteSource: false })

  assert.is(updatedQuantity, 8)
  assert.not.ok(sourceDeleted)
})

test("mergeItemStacks: throws error for non-stackable items", async () => {
  const target = createMockItem({ system: { isEquipped: true } })
  const source = createMockItem({ id: "source" })

  try {
    await mergeItemStacks(target, source)
    assert.unreachable("Should have thrown an error")
  } catch (err) {
    assert.match(err.message, /not stackable/)
  }
})

// === splitItemStack Tests ====================================================

test("splitItemStack: creates new item with split quantity", async () => {
  const originalItem = createMockItem({ system: { quantity: 10 } })

  let updatedQuantity = null
  let createdItemData = null

  originalItem.update = async (data) => {
    updatedQuantity = data["system.quantity"]
    originalItem.system.quantity = updatedQuantity
  }

  originalItem.parent = {
    createEmbeddedDocuments: async (type, dataArray) => {
      createdItemData = dataArray[0]
      return [createMockItem(createdItemData)]
    },
  }

  // toObject should return a deep copy, not a reference
  originalItem.toObject = () => JSON.parse(JSON.stringify(originalItem))

  const newItem = await splitItemStack(originalItem, 3)

  assert.is(updatedQuantity, 7, "Original item should have 7 remaining")
  assert.is(createdItemData.system.quantity, 3, "New item should have 3")
})

test("splitItemStack: throws error for non-physical items", async () => {
  const item = createMockItem({
    system: { isPhysicalItem: false, quantity: 10 },
  })

  try {
    await splitItemStack(item, 3)
    assert.unreachable("Should have thrown an error")
  } catch (err) {
    assert.match(err.message, /non-physical/)
  }
})

test("splitItemStack: throws error for invalid split quantity (too small)", async () => {
  const item = createMockItem({ system: { quantity: 10 } })

  try {
    await splitItemStack(item, 0)
    assert.unreachable("Should have thrown an error")
  } catch (err) {
    assert.match(err.message, /Invalid split quantity/)
  }
})

test("splitItemStack: throws error for invalid split quantity (too large)", async () => {
  const item = createMockItem({ system: { quantity: 10 } })

  try {
    await splitItemStack(item, 10)
    assert.unreachable("Should have thrown an error")
  } catch (err) {
    assert.match(err.message, /Invalid split quantity/)
  }
})

test("splitItemStack: throws error for negative split quantity", async () => {
  const item = createMockItem({ system: { quantity: 10 } })

  try {
    await splitItemStack(item, -5)
    assert.unreachable("Should have thrown an error")
  } catch (err) {
    assert.match(err.message, /Invalid split quantity/)
  }
})

test.run()
