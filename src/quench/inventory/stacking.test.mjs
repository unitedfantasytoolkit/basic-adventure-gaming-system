/**
 * @file Integration tests for item stacking.
 *
 * Stacking decides whether two items are "the same thing" and can be collapsed
 * into one row with a quantity. Getting it wrong in either direction is bad:
 * merge too eagerly and a player loses an enchanted sword into a pile of
 * ordinary ones, merge too shyly and an inventory fills with fifty single
 * arrows.
 *
 * The rules read Item documents, their embedded Active Effects and their
 * identification state, and the merge and split operations create and delete real
 * documents, so this all needs a live world.
 */

import {
  captureRejection,
  cleanUpDocuments,
  createTestCharacter,
  createTestItem,
} from "../helpers.mjs"
import {
  canItemsStack,
  findStackableMatches,
  mergeItemStacks,
  splitItemStack,
  stackAllItems,
} from "../../utils/item-stacking.mjs"

/**
 * Register the item stacking test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerStackingTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.inventory.stacking",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A shared base item id, so fixtures represent the same catalogue entry.
       *
       * Items only stack when they agree on `baseItemId`, and every freshly
       * created item gets a random one -- so a test that doesn't pin this is
       * really testing "two different things don't stack".
       * @type {string}
       */
      const BASE_ITEM_ID = "quench-test-base-item"

      /**
       * Create a stackable arrow-like item on an actor.
       * @param {Actor} actor - The owning actor
       * @param {object} [overrides] - System data to merge in
       * @param {string} [name] - The item's name
       * @returns {Promise<Item>} The created Item
       */
      const createStackable = (actor, overrides = {}, name = "Arrows") =>
        createTestItem(
          {
            type: "item",
            name,
            system: foundry.utils.mergeObject(
              {
                baseItemId: BASE_ITEM_ID,
                quantity: 1,
                weight: 1,
                cost: 1,
              },
              overrides,
              { inplace: false },
            ),
          },
          actor,
        )

      describe("Deciding whether two items stack", function stackRules() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("stacks two identical items", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor)
          const second = await createStackable(actor)

          assert.isTrue(canItemsStack(first, second))
        })

        it("does not stack items from different catalogue entries", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor)
          const second = await createStackable(actor, {
            baseItemId: "something-else",
          })

          assert.isFalse(canItemsStack(first, second))
        })

        it("treats an item with no base id as unique", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor, { baseItemId: null })
          const second = await createStackable(actor, { baseItemId: null })

          assert.isFalse(canItemsStack(first, second))
        })

        it("does not stack renamed items", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor)
          const second = await createStackable(actor, {}, "Silver Arrows")

          assert.isFalse(canItemsStack(first, second))
        })

        it("does not stack items of different types", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor)
          const second = await createTestItem(
            {
              type: "weapon",
              name: "Arrows",
              system: { baseItemId: BASE_ITEM_ID, weight: 1, cost: 1 },
            },
            actor,
          )

          assert.isFalse(canItemsStack(first, second))
        })

        it("does not stack items that differ in cost or weight", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor)
          const pricier = await createStackable(actor, { cost: 5 })
          const heavier = await createStackable(actor, { weight: 5 })

          assert.isFalse(canItemsStack(first, pricier))
          assert.isFalse(canItemsStack(first, heavier))
        })

        it("does not stack containers", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor, {
            container: { isContainer: true },
          })
          const second = await createStackable(actor, {
            container: { isContainer: true },
          })

          assert.isFalse(canItemsStack(first, second))
        })

        it("does not stack unidentified items", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor, {
            identification: { isIdentified: false },
          })
          const second = await createStackable(actor)

          assert.isFalse(
            canItemsStack(first, second),
            "an unidentified item must not reveal itself by stacking",
          )
        })

        it("does not stack an equipped item", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor)
          const second = await createStackable(actor)

          await second.equip()

          assert.isFalse(canItemsStack(first, second))
        })

        it("does not stack an item carrying an Active Effect", async () => {
          const actor = await createTestCharacter()
          const plain = await createStackable(actor)
          const enchanted = await createStackable(actor)

          await enchanted.createEmbeddedDocuments("ActiveEffect", [
            { name: "Flaming" },
          ])

          assert.isFalse(
            canItemsStack(plain, enchanted),
            "an enchanted item is not the same thing as a plain one",
          )
        })

        it("does not stack a partly used item", async () => {
          const actor = await createTestCharacter()
          const full = await createStackable(actor, {
            uses: { value: 3, max: 3 },
          })
          const used = await createStackable(actor, {
            uses: { value: 1, max: 3 },
          })

          assert.isTrue(canItemsStack(full, full))
          assert.isFalse(canItemsStack(full, used))
        })

        it("respects an explicit refusal to stack", async () => {
          const actor = await createTestCharacter()
          const first = await createStackable(actor, { isStackable: false })
          const second = await createStackable(actor)

          assert.isFalse(canItemsStack(first, second))
        })

        it("does not stack across a difference in treasure accounting", async () => {
          const actor = await createTestCharacter()
          const counted = await createStackable(actor, {
            hasBeenCountedAsTreasure: true,
          })
          const uncounted = await createStackable(actor)

          assert.isFalse(
            canItemsStack(counted, uncounted),
            "merging these would award experience twice or not at all",
          )
        })

        it("does not stack non-physical items", async () => {
          const actor = await createTestCharacter()
          const first = await createTestItem(
            { type: "spell", name: "Magic Missile" },
            actor,
          )
          const second = await createTestItem(
            { type: "spell", name: "Magic Missile" },
            actor,
          )

          assert.isFalse(canItemsStack(first, second))
        })
      })

      describe("Finding matches", function findingMatches() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("finds every match in an inventory but itself", async () => {
          const actor = await createTestCharacter()
          const arrows = await createStackable(actor)
          await createStackable(actor)
          await createStackable(actor)
          await createStackable(actor, { baseItemId: "other" })

          const matches = findStackableMatches(arrows, actor)

          assert.lengthOf(matches, 2)
          assert.notInclude(
            matches.map((match) => match.id),
            arrows.id,
          )
        })

        it("finds nothing in an inventory of unique items", async () => {
          const actor = await createTestCharacter()
          const arrows = await createStackable(actor)
          await createStackable(actor, {}, "Silver Arrows")

          assert.lengthOf(findStackableMatches(arrows, actor), 0)
        })
      })

      describe("Merging", function merging() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("adds the source's quantity to the target and deletes it", async () => {
          const actor = await createTestCharacter()
          const target = await createStackable(actor, { quantity: 10 })
          const source = await createStackable(actor, { quantity: 5 })

          await mergeItemStacks(target, source)

          assert.strictEqual(target.system.quantity, 15)
          assert.isFalse(
            actor.items.has(source.id),
            "the source stack should be gone",
          )
        })

        it("can keep the source when asked to", async () => {
          const actor = await createTestCharacter()
          const target = await createStackable(actor, { quantity: 10 })
          const source = await createStackable(actor, { quantity: 5 })

          await mergeItemStacks(target, source, { deleteSource: false })

          assert.strictEqual(target.system.quantity, 15)
          assert.isTrue(actor.items.has(source.id))
        })

        it("refuses to merge items that don't stack", async () => {
          const actor = await createTestCharacter()
          const target = await createStackable(actor)
          const source = await createStackable(actor, {}, "Silver Arrows")

          const error = await captureRejection(() =>
            mergeItemStacks(target, source),
          )

          assert.isOk(error, "merging mismatched items should fail")
          assert.match(error.message, /not stackable/)
        })
      })

      describe("Splitting", function splitting() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("moves part of a stack into a new item", async () => {
          const actor = await createTestCharacter()
          const arrows = await createStackable(actor, { quantity: 20 })

          const split = await splitItemStack(arrows, 5)

          assert.strictEqual(split.system.quantity, 5)
          assert.strictEqual(arrows.system.quantity, 15)
          assert.strictEqual(split.name, arrows.name)
          assert.notStrictEqual(
            split.id,
            arrows.id,
            "the split should be its own document",
          )
          assert.isTrue(
            canItemsStack(arrows, split),
            "a split stack should be able to merge straight back",
          )
        })

        it("refuses to split off more than the stack holds", async () => {
          const actor = await createTestCharacter()
          const arrows = await createStackable(actor, { quantity: 5 })

          const tooMany = await captureRejection(() =>
            splitItemStack(arrows, 5),
          )
          const negative = await captureRejection(() =>
            splitItemStack(arrows, -1),
          )

          assert.isOk(tooMany, "splitting off the whole stack should fail")
          assert.isOk(negative, "splitting off nothing should fail")
          assert.strictEqual(arrows.system.quantity, 5)
        })

        it("refuses to split a non-physical item", async () => {
          const actor = await createTestCharacter()
          const spell = await createTestItem({ type: "spell" }, actor)

          const error = await captureRejection(() => splitItemStack(spell, 1))

          assert.isOk(error, "splitting a spell should fail")
        })
      })

      describe("Consolidating a whole inventory", function consolidating() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("collapses matching stacks and leaves the rest alone", async () => {
          const actor = await createTestCharacter()
          await createStackable(actor, { quantity: 3 })
          await createStackable(actor, { quantity: 4 })
          await createStackable(actor, { quantity: 5 })
          const unique = await createStackable(actor, {}, "Silver Arrows")

          const consolidated = await stackAllItems(actor.items.contents)

          assert.strictEqual(consolidated, 1, "one group should have collapsed")

          const arrows = actor.items.filter((item) => item.name === "Arrows")
          assert.lengthOf(arrows, 1)
          assert.strictEqual(arrows[0].system.quantity, 12)
          assert.isTrue(
            actor.items.has(unique.id),
            "an unrelated item should survive untouched",
          )
        })

        it("does nothing to an inventory with nothing to merge", async () => {
          const actor = await createTestCharacter()
          await createStackable(actor)
          await createStackable(actor, {}, "Silver Arrows")

          assert.strictEqual(await stackAllItems(actor.items.contents), 0)
          assert.strictEqual(actor.items.size, 2)
        })

        it("leaves equipped and enchanted items out of the merge", async () => {
          const actor = await createTestCharacter()
          const equipped = await createStackable(actor, { quantity: 1 })
          await createStackable(actor, { quantity: 2 })
          await createStackable(actor, { quantity: 3 })

          await equipped.equip()

          await stackAllItems(actor.items.contents)

          assert.isTrue(
            actor.items.has(equipped.id),
            "the equipped item should not have been swallowed",
          )
          assert.strictEqual(equipped.system.quantity, 1)
        })
      })
    },
    { displayName: "BAGS: Item stacking" },
  )
}
