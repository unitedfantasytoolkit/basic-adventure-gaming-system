/**
 * @file Integration tests for containers.
 *
 * Containers are stored as an array of UUIDs on the container Item, which means
 * every interesting behaviour here depends on UUID resolution against a real
 * world: contents that resolve, contents that have been deleted, contents that
 * belong to a different actor, and containers nested inside each other.
 *
 * The weight rules are the subtle part. A container's `contentsWeight` applies
 * its own modifier to everything inside it -- that's how a bag of holding works --
 * and nested containers have to apply their modifiers innermost-first without
 * double counting.
 */

import {
  captureRejection,
  cleanUpDocuments,
  createTestCharacter,
  createTestItem,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the container test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerContainerTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.inventory.containers",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * Create a container Item on an actor.
       * @param {Actor} actor - The owning actor
       * @param {object} [options] - Container options
       * @param {string} [options.name] - The container's name
       * @param {number} [options.weight] - The empty container's own weight
       * @param {number} [options.weightMax] - Capacity, or 0 for unlimited
       * @param {number} [options.weightModifier] - Multiplier applied to contents
       * @returns {Promise<Item>} The created container
       */
      const createContainer = (
        actor,
        {
          name = "Backpack",
          weight = 0,
          weightMax = 0,
          weightModifier = 1,
        } = {},
      ) =>
        createTestItem(
          {
            type: "item",
            name,
            system: {
              weight,
              container: { isContainer: true, weightMax, weightModifier },
            },
          },
          actor,
        )

      /**
       * Create an ordinary piece of gear on an actor.
       * @param {Actor} actor - The owning actor
       * @param {object} [options] - Gear options
       * @param {string} [options.name] - The item's name
       * @param {number} [options.weight] - Weight per unit
       * @param {number} [options.quantity] - How many
       * @returns {Promise<Item>} The created Item
       */
      const createGear = (
        actor,
        { name = "Gear", weight = 10, quantity = 1 } = {},
      ) =>
        createTestItem(
          { type: "item", name, system: { weight, quantity } },
          actor,
        )

      describe("Adding and removing", function addRemove() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("puts an item into a container", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope" })

          await rope.addToContainer(backpack)

          assert.include(backpack.system.container.contains, rope.uuid)
          assert.lengthOf(backpack.system.contents, 1)
          assert.strictEqual(backpack.system.contents[0].id, rope.id)
        })

        it("tells an item which container holds it", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope" })

          assert.isFalse(rope.system.isInContainer)
          assert.isNull(rope.system.parentContainer)

          await rope.addToContainer(backpack)

          assert.isTrue(rope.system.isInContainer)
          assert.strictEqual(rope.system.parentContainer.id, backpack.id)
        })

        it("treats adding twice as a no-op", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope" })

          await rope.addToContainer(backpack)
          await rope.addToContainer(backpack)

          assert.lengthOf(backpack.system.container.contains, 1)
        })

        it("takes an item back out again", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope" })

          await rope.addToContainer(backpack)
          await rope.removeFromContainer()

          assert.lengthOf(backpack.system.contents, 0)
          assert.isFalse(rope.system.isInContainer)
        })

        it("shrugs off removing an item that isn't in a container", async () => {
          const actor = await createTestCharacter()
          const rope = await createGear(actor, { name: "Rope" })

          assert.isNull(await rope.removeFromContainer())
        })

        it("moves an item from one container to another", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor, { name: "Backpack" })
          const chest = await createContainer(actor, { name: "Chest" })
          const rope = await createGear(actor, { name: "Rope" })

          await rope.addToContainer(backpack)
          await rope.removeFromContainer()
          await rope.addToContainer(chest)

          assert.lengthOf(backpack.system.contents, 0)
          assert.lengthOf(chest.system.contents, 1)
        })
      })

      describe("Validation", function validation() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("refuses a target that isn't a container", async () => {
          const actor = await createTestCharacter()
          const rock = await createGear(actor, { name: "Rock" })
          const rope = await createGear(actor, { name: "Rope" })

          const error = await captureRejection(() => rope.addToContainer(rock))

          assert.isOk(error, "adding to a non-container should fail")
        })

        it("refuses to put a container inside itself", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)

          const error = await captureRejection(() =>
            backpack.addToContainer(backpack),
          )

          assert.isOk(error, "self-containment should fail")
        })

        it("refuses a circular nesting", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor, { name: "Backpack" })
          const pouch = await createContainer(actor, { name: "Pouch" })

          await pouch.addToContainer(backpack)

          const error = await captureRejection(() =>
            backpack.addToContainer(pouch),
          )

          assert.isOk(error, "a container cannot hold its own holder")
        })

        it("refuses an item belonging to a different actor", async () => {
          const owner = await createTestCharacter()
          const stranger = await createTestCharacter()
          const backpack = await createContainer(owner)
          const rope = await createGear(stranger, { name: "Rope" })

          const error = await captureRejection(() =>
            rope.addToContainer(backpack),
          )

          assert.isOk(error, "cross-actor containment should fail")
        })

        it("refuses to overfill a container with a capacity", async () => {
          const actor = await createTestCharacter()
          const pouch = await createContainer(actor, {
            name: "Pouch",
            weightMax: 100,
          })
          const light = await createGear(actor, { name: "Light", weight: 40 })
          const heavy = await createGear(actor, { name: "Heavy", weight: 80 })

          await light.addToContainer(pouch)

          const error = await captureRejection(() =>
            heavy.addToContainer(pouch),
          )

          assert.isOk(error, "going over capacity should fail")
          assert.lengthOf(pouch.system.contents, 1)
        })

        it("allows a load that exactly fills a container", async () => {
          const actor = await createTestCharacter()
          const pouch = await createContainer(actor, {
            name: "Pouch",
            weightMax: 100,
          })
          const exact = await createGear(actor, { name: "Exact", weight: 100 })

          await exact.addToContainer(pouch)

          assert.lengthOf(pouch.system.contents, 1)
        })

        it("ignores capacity when no maximum is set", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const anvil = await createGear(actor, { name: "Anvil", weight: 5000 })

          await anvil.addToContainer(backpack)

          assert.lengthOf(backpack.system.contents, 1)
        })
      })

      describe("Contents weight", function contentsWeight() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("is zero for an empty container", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)

          assert.strictEqual(backpack.system.contentsWeight, 0)
        })

        it("is zero for an item that isn't a container", async () => {
          const actor = await createTestCharacter()
          const rock = await createGear(actor, { name: "Rock" })

          assert.strictEqual(rock.system.contentsWeight, 0)
        })

        it("adds up its contents, quantity included", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope", weight: 50 })
          const rations = await createGear(actor, {
            name: "Rations",
            weight: 10,
            quantity: 3,
          })

          await rope.addToContainer(backpack)
          await rations.addToContainer(backpack)

          assert.strictEqual(backpack.system.contentsWeight, 80)
        })

        it("applies its weight modifier to everything inside", async () => {
          const actor = await createTestCharacter()
          const bagOfHolding = await createContainer(actor, {
            name: "Bag of Holding",
            weightModifier: 0.5,
          })
          const anvil = await createGear(actor, { name: "Anvil", weight: 100 })

          await anvil.addToContainer(bagOfHolding)

          assert.strictEqual(bagOfHolding.system.contentsWeight, 50)
        })

        it("counts a nested container's contents through both modifiers", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor, {
            name: "Backpack",
            weightModifier: 0.5,
          })
          const pouch = await createContainer(actor, {
            name: "Pouch",
            weight: 10,
            weightModifier: 0.5,
          })
          const coins = await createGear(actor, { name: "Coins", weight: 100 })

          await coins.addToContainer(pouch)
          await pouch.addToContainer(backpack)

          // The pouch halves its 100 coins to 50, and carries its own 10.
          assert.strictEqual(pouch.system.contentsWeight, 50)
          // The backpack then halves the pouch's 10 + 50 = 60 down to 30.
          assert.strictEqual(backpack.system.contentsWeight, 30)
        })

        it("drops contents that have been deleted", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope", weight: 50 })

          await rope.addToContainer(backpack)
          assert.strictEqual(backpack.system.contentsWeight, 50)

          await rope.delete()

          assert.lengthOf(backpack.system.contents, 0)
          assert.strictEqual(backpack.system.contentsWeight, 0)
        })
      })

      describe("Stale reference cleaning", function staleRefs() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("strips UUIDs that no longer resolve when the container updates", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope" })

          await rope.addToContainer(backpack)
          await rope.delete()

          // The deleted item's UUID is still on the container until something
          // writes to it; the pre-update hook is what tidies it away.
          await backpack.update({
            "system.container.contains": backpack.system.container.contains,
          })

          assert.lengthOf(backpack.system.container.contains, 0)
        })

        it("keeps UUIDs that still resolve", async () => {
          const actor = await createTestCharacter()
          const backpack = await createContainer(actor)
          const rope = await createGear(actor, { name: "Rope" })
          const torch = await createGear(actor, { name: "Torch" })

          await rope.addToContainer(backpack)
          await torch.addToContainer(backpack)
          await rope.delete()

          await backpack.update({
            "system.container.contains": backpack.system.container.contains,
          })

          assert.deepEqual(backpack.system.container.contains, [torch.uuid])
        })
      })

      describe("Encumbrance integration", function encumbranceIntegration() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("counts contained treasure at its own weight, not the container's", async () => {
          const actor = await createTestCharacter()
          const bagOfHolding = await createContainer(actor, {
            name: "Bag of Holding",
            weight: 20,
            weightModifier: 0.5,
          })
          const treasure = await createTestItem(
            {
              type: "item",
              name: "Coins",
              system: { weight: 200, countsAsTreasure: true },
            },
            actor,
          )

          await treasure.addToContainer(bagOfHolding)

          const category = CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE

          const encumbrance = await withRulesModule(
            category,
            "bx-detailed",
            () => actor.system.encumbrance.value,
          )

          // The bag knows its contents are lighter: 200 coins halved to 100.
          assert.strictEqual(bagOfHolding.system.contentsWeight, 100)

          // Encumbrance, though, walks the actor's Items directly rather than
          // through their containers, so the coins are counted at their full 200
          // and the bag's modifier never gets a look in. 80 more is the flat
          // adventuring gear burden, which the bag itself triggers.
          //
          // This is a characterisation test, not an endorsement: if containers
          // start feeding their discounts into encumbrance, this is the test that
          // should change, and it should change deliberately.
          assert.strictEqual(encumbrance, 280)
        })
      })
    },
    { displayName: "BAGS: Containers" },
  )
}
