/**
 * @file Tests for recursive container weight calculations
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import getEffectiveItemWeight from "../src/utils/get-effective-item-weight.mjs"

// === Test Helpers ============================================================

/**
 * Create a mock item for testing
 */
function createMockItem(overrides = {}) {
  const id = overrides.id || `item-${Math.random().toString(36).substring(7)}`
  const uuid = overrides.uuid || `Actor.actor-123.Item.${id}`

  const item = {
    id,
    uuid,
    name: overrides.name || "Test Item",
    type: overrides.type || "item",
    actor: overrides.actor || null,
    system: {
      weight: 10,
      quantity: 1,
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

  // Add computed properties
  Object.defineProperty(item.system, "parentContainer", {
    get() {
      if (!item.actor) return null
      return (
        item.actor.items.find((i) =>
          i.system.container?.contains?.includes(item.uuid),
        ) || null
      )
    },
  })

  Object.defineProperty(item.system, "contents", {
    get() {
      if (!item.system.container?.isContainer || !item.actor) return []
      const actor = item.actor
      return (item.system.container.contains || [])
        .map((uuid) => actor.items.find((i) => i.uuid === uuid))
        .filter((i) => i && i.actor === actor)
    },
  })

  Object.defineProperty(item.system, "contentsWeight", {
    get() {
      if (!item.system.container?.isContainer) return 0

      const baseWeight = item.system.contents.reduce((total, i) => {
        const itemWeight = i.system.weight * i.system.quantity
        const itemContents = i.system.container?.isContainer
          ? i.system.contentsWeight
          : 0
        return total + itemWeight + itemContents
      }, 0)

      return baseWeight * (item.system.container.weightModifier ?? 1)
    },
  })

  return item
}

/**
 * Create a mock actor with items
 */
function createMockActor(items = []) {
  const actor = {
    id: "actor-123",
    items: items,
  }

  items.forEach((item) => {
    item.actor = actor
  })

  return actor
}

// === Tests ===================================================================

// --- Basic Weight Calculation ------------------------------------------------

test("getEffectiveItemWeight: simple item weight", () => {
  const item = createMockItem({ system: { weight: 10, quantity: 1 } })
  assert.is(getEffectiveItemWeight(item), 10)
})

test("getEffectiveItemWeight: respects quantity", () => {
  const item = createMockItem({ system: { weight: 10, quantity: 5 } })
  assert.is(getEffectiveItemWeight(item), 50)
})

test("getEffectiveItemWeight: empty container has only own weight", () => {
  const container = createMockItem({
    system: { weight: 5, quantity: 1 },
    container: { isContainer: true, contains: [] },
  })
  createMockActor([container])

  assert.is(getEffectiveItemWeight(container), 5)
})

// --- Container Contents Weight -----------------------------------------------

test("getEffectiveItemWeight: container includes contents weight", () => {
  const item = createMockItem({
    id: "item-1",
    system: { weight: 10, quantity: 1 },
  })
  const container = createMockItem({
    id: "container-1",
    system: { weight: 5, quantity: 1 },
    container: {
      isContainer: true,
      contains: [item.uuid],
    },
  })

  createMockActor([item, container])

  // Container weight = own weight (5) + contents (10) = 15
  assert.is(getEffectiveItemWeight(container), 15)
})

test("getEffectiveItemWeight: container with multiple items", () => {
  const item1 = createMockItem({
    id: "item-1",
    system: { weight: 10, quantity: 2 }, // 20 total
  })
  const item2 = createMockItem({
    id: "item-2",
    system: { weight: 5, quantity: 3 }, // 15 total
  })
  const container = createMockItem({
    id: "container-1",
    system: { weight: 2, quantity: 1 },
    container: {
      isContainer: true,
      contains: [item1.uuid, item2.uuid],
    },
  })

  createMockActor([item1, item2, container])

  // Container weight = own (2) + item1 (20) + item2 (15) = 37
  assert.is(getEffectiveItemWeight(container), 37)
})

// --- Nested Containers (Recursion) ------------------------------------------

test("getEffectiveItemWeight: nested containers calculate correctly", () => {
  const item = createMockItem({
    id: "item-1",
    system: { weight: 10, quantity: 1 },
  })
  const innerBag = createMockItem({
    id: "inner-bag",
    system: { weight: 2, quantity: 1 },
    container: {
      isContainer: true,
      contains: [item.uuid],
    },
  })
  const outerBag = createMockItem({
    id: "outer-bag",
    system: { weight: 3, quantity: 1 },
    container: {
      isContainer: true,
      contains: [innerBag.uuid],
    },
  })

  createMockActor([item, innerBag, outerBag])

  // Inner bag = 2 (own) + 10 (item) = 12
  assert.is(getEffectiveItemWeight(innerBag), 12)

  // Outer bag = 3 (own) + 12 (inner bag with contents) = 15
  assert.is(getEffectiveItemWeight(outerBag), 15)
})

// --- Container Weight Modifiers ----------------------------------------------

test("getEffectiveItemWeight: weight modifier applies to contained items", () => {
  const item = createMockItem({
    id: "item-1",
    system: { weight: 100, quantity: 1 },
  })
  const bagOfHolding = createMockItem({
    id: "bag-of-holding",
    system: { weight: 15, quantity: 1 },
    container: {
      isContainer: true,
      contains: [item.uuid],
      weightModifier: 0.1, // Items weigh 10%
    },
  })

  createMockActor([item, bagOfHolding])

  // Item inside bag weighs 100 * 0.1 = 10
  // Bag weight = 15 (own) + 10 (modified item) = 25
  assert.is(getEffectiveItemWeight(bagOfHolding), 25)
})

test("getEffectiveItemWeight: nested containers with modifiers", () => {
  const item = createMockItem({
    id: "item-1",
    system: { weight: 50, quantity: 1 },
  })
  const pouch = createMockItem({
    id: "pouch",
    system: { weight: 1, quantity: 1 },
    container: {
      isContainer: true,
      contains: [item.uuid],
      weightModifier: 0.5, // Items weigh 50%
    },
  })
  const backpack = createMockItem({
    id: "backpack",
    system: { weight: 5, quantity: 1 },
    container: {
      isContainer: true,
      contains: [pouch.uuid],
      weightModifier: 1, // No modifier
    },
  })

  createMockActor([item, pouch, backpack])

  // Item in pouch: 50 * 0.5 = 25
  // Pouch weight: 1 (own) + 25 (item) = 26
  // Pouch in backpack: 26 * 1 = 26 (no modifier)
  // Backpack weight: 5 (own) + 26 (pouch) = 31
  assert.is(getEffectiveItemWeight(pouch), 26)
  assert.is(getEffectiveItemWeight(backpack), 31)
})

// --- Edge Cases --------------------------------------------------------------

test("getEffectiveItemWeight: zero quantity returns zero", () => {
  const item = createMockItem({ system: { weight: 100, quantity: 0 } })
  assert.is(getEffectiveItemWeight(item), 0)
})

test("getEffectiveItemWeight: negative weight returns zero", () => {
  const item = createMockItem({ system: { weight: -10, quantity: 1 } })
  assert.is(getEffectiveItemWeight(item), 0)
})

test("getEffectiveItemWeight: container with zero weight modifier", () => {
  const item = createMockItem({
    id: "item-1",
    system: { weight: 100, quantity: 1 },
  })
  const bag = createMockItem({
    id: "bag",
    system: { weight: 1, quantity: 1 },
    container: {
      isContainer: true,
      contains: [item.uuid],
      weightModifier: 0, // Weightless!
    },
  })

  createMockActor([item, bag])

  // Bag weight = 1 (own) + 0 (modified item) = 1
  assert.is(getEffectiveItemWeight(bag), 1)
})

test.run()
