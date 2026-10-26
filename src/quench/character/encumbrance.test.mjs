/**
 * @file Integration tests for the encumbrance rules modules.
 *
 * BAGS ships two encumbrance systems and lets a world pick between them at
 * runtime. Both read the character's owned Items and any Active Effects that
 * modify their thresholds, so both need real documents to test at all.
 *
 * The two count entirely different things -- basic encumbrance only cares about
 * treasure, detailed encumbrance weighs every piece of gear -- which makes this a
 * good place for a swapped-setting test to catch a getter that has quietly
 * hard-coded one system's assumptions.
 */

import {
  cleanUpDocuments,
  createTestCharacter,
  createTestItem,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the encumbrance test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerEncumbranceTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.encumbrance",
    (context) => {
      const { describe, it, assert, after } = context

      const category = () => CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE

      /**
       * Run a callback with basic (treasure only) encumbrance selected.
       * @template T
       * @param {() => Promise<T>|T} callback - The work to do
       * @returns {Promise<T>} Whatever the callback returned
       */
      const withBasic = (callback) =>
        withRulesModule(category(), "bx-basic", callback)

      /**
       * Run a callback with detailed (weigh everything) encumbrance selected.
       * @template T
       * @param {() => Promise<T>|T} callback - The work to do
       * @returns {Promise<T>} Whatever the callback returned
       */
      const withDetailed = (callback) =>
        withRulesModule(category(), "bx-detailed", callback)

      /**
       * Add a piece of treasure to a character.
       * @param {Actor} actor - The character to give treasure to
       * @param {number} weight - Weight per unit, in coins
       * @param {number} [quantity] - How many
       * @returns {Promise<Item>} The created Item
       */
      const giveTreasure = (actor, weight, quantity = 1) =>
        createTestItem(
          {
            type: "item",
            name: "Coins",
            system: { weight, quantity, countsAsTreasure: true },
          },
          actor,
        )

      describe("Basic encumbrance", function basicEncumbrance() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("counts treasure and nothing else", async () => {
          const actor = await createTestCharacter()
          await giveTreasure(actor, 100, 2)
          // A sword and a suit of armor are free under the basic rules.
          await createTestItem(
            { type: "weapon", system: { weight: 60 } },
            actor,
          )
          await createTestItem(
            { type: "armor", system: { weight: 500 } },
            actor,
          )

          await withBasic(() => {
            assert.strictEqual(actor.system.encumbrance.value, 200)
          })
        })

        it("ignores gear that isn't treasure", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "item",
              name: "Rope",
              system: { weight: 50, countsAsTreasure: false },
            },
            actor,
          )

          await withBasic(() => {
            assert.strictEqual(actor.system.encumbrance.value, 0)
          })
        })

        it("uses the B/X significant and maximum thresholds", async () => {
          const actor = await createTestCharacter()

          await withBasic(() => {
            const { thresholds } = actor.system.encumbrance

            assert.strictEqual(thresholds.significant, 800)
            assert.strictEqual(thresholds.maximum, 1600)
          })
        })

        it("moves at full speed while unencumbered and unarmoured", async () => {
          const actor = await createTestCharacter()

          await withBasic(() => {
            const { exploration, encounter, overland } = actor.system.speed

            assert.strictEqual(exploration, 120)
            assert.strictEqual(encounter, 40)
            assert.strictEqual(overland, 24)
          })
        })

        it("slows down for light armor, then heavy armor", async () => {
          const actor = await createTestCharacter()
          const light = await createTestItem(
            { type: "armor", name: "Leather", system: { isHeavy: false } },
            actor,
          )

          await withBasic(() => {
            assert.strictEqual(actor.system.speed.exploration, 90)
          })

          await light.update({ "system.isHeavy": true })

          await withBasic(() => {
            assert.strictEqual(actor.system.speed.exploration, 60)
          })
        })

        it("slows down again once carrying significant treasure", async () => {
          const actor = await createTestCharacter()
          // Past the 800 coin significant threshold.
          await giveTreasure(actor, 900)

          await withBasic(() => {
            assert.strictEqual(actor.system.speed.exploration, 90)
          })

          await createTestItem(
            { type: "armor", name: "Plate", system: { isHeavy: true } },
            actor,
          )

          await withBasic(() => {
            assert.strictEqual(actor.system.speed.exploration, 30)
          })
        })
      })

      describe("Detailed encumbrance", function detailedEncumbrance() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("weighs weapons, armor and treasure", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            { type: "weapon", name: "Sword", system: { weight: 60 } },
            actor,
          )
          await createTestItem(
            { type: "armor", name: "Chain", system: { weight: 400 } },
            actor,
          )
          await giveTreasure(actor, 100, 2)

          await withDetailed(() => {
            assert.strictEqual(actor.system.encumbrance.value, 660)
          })
        })

        it("adds a flat burden for carrying any adventuring gear", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "item",
              name: "Torches",
              system: { weight: 0, countsAsTreasure: false },
            },
            actor,
          )

          await withDetailed(() => {
            // One item of gear costs the whole 80 coin allowance; a second
            // shouldn't cost anything more.
            assert.strictEqual(actor.system.encumbrance.value, 80)
          })

          await createTestItem(
            {
              type: "item",
              name: "Rations",
              system: { weight: 0, countsAsTreasure: false },
            },
            actor,
          )

          await withDetailed(() => {
            assert.strictEqual(actor.system.encumbrance.value, 80)
          })
        })

        it("multiplies weight by quantity", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "weapon",
              name: "Daggers",
              system: { weight: 10, quantity: 5 },
            },
            actor,
          )

          await withDetailed(() => {
            assert.strictEqual(actor.system.encumbrance.value, 50)
          })
        })

        it("orders its four thresholds", async () => {
          const actor = await createTestCharacter()

          await withDetailed(() => {
            const { light, medium, heavy, maximum } =
              actor.system.encumbrance.thresholds

            assert.isBelow(light, medium)
            assert.isBelow(medium, heavy)
            assert.isBelow(heavy, maximum)
          })
        })

        it("uses the B/X weight thresholds", async () => {
          const actor = await createTestCharacter()

          await withDetailed(() => {
            const { light, medium, heavy, maximum } =
              actor.system.encumbrance.thresholds

            // Straight from the rules: a character slows at 400, 600 and 800
            // coins of gear, and can't move at all past 1600.
            assert.strictEqual(light, 400)
            assert.strictEqual(medium, 600)
            assert.strictEqual(heavy, 800)
            assert.strictEqual(maximum, 1600)
          })
        })

        it("steps speed down through each threshold", async () => {
          const actor = await createTestCharacter()
          const load = await createTestItem(
            { type: "weapon", name: "Anvil", system: { weight: 100 } },
            actor,
          )

          /**
           * The character's exploration speed carrying a given weight.
           * @param {number} weight - The weight to carry
           * @returns {Promise<number>} Exploration speed in feet
           */
          const speedCarrying = async (weight) => {
            await load.update({ "system.weight": weight })
            return withDetailed(() => actor.system.speed.exploration)
          }

          assert.strictEqual(await speedCarrying(100), 120)
          assert.strictEqual(await speedCarrying(500), 90)
          assert.strictEqual(await speedCarrying(700), 60)
          assert.strictEqual(await speedCarrying(900), 30)
          assert.strictEqual(await speedCarrying(2000), 0)
        })
      })

      describe("Swapping the selected system", function swapping() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("changes what the same character is carrying", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            { type: "armor", name: "Plate", system: { weight: 500 } },
            actor,
          )

          const basic = await withBasic(() => actor.system.encumbrance.value)
          const detailed = await withDetailed(
            () => actor.system.encumbrance.value,
          )

          assert.strictEqual(basic, 0, "basic encumbrance ignores armor")
          assert.strictEqual(detailed, 500, "detailed encumbrance weighs it")
        })
      })

      describe("Active Effect modifiers", function effectModifiers() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        /**
         * Give a character an Active Effect that changes one numeric key.
         * @param {Actor} actor - The character to affect
         * @param {string} key - The data path the effect changes
         * @param {number} value - The amount to add
         * @returns {Promise<ActiveEffect>} The created effect
         */
        const addModifier = async (actor, key, value) => {
          const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
            {
              name: `Test ${key}`,
              system: {
                changes: [
                  {
                    key,
                    value: `${value}`,
                    type: "add",
                  },
                ],
              },
            },
          ])
          return effect
        }

        it("raises the maximum a character can carry", async () => {
          const actor = await createTestCharacter()

          const before = await withBasic(
            () => actor.system.encumbrance.thresholds.maximum,
          )

          await addModifier(
            actor,
            "system.modifiers.encumbranceMaximumModifier",
            400,
          )

          const raised = await withBasic(
            () => actor.system.encumbrance.thresholds.maximum,
          )

          assert.strictEqual(raised, before + 400)
        })

        it("scales every threshold with a multiplier", async () => {
          const actor = await createTestCharacter()

          const before = await withBasic(
            () => actor.system.encumbrance.thresholds.significant,
          )

          await addModifier(actor, "system.modifiers.encumbranceMultiplier", 2)

          const scaled = await withBasic(
            () => actor.system.encumbrance.thresholds.significant,
          )

          assert.strictEqual(scaled, before * 2)
        })

        it("adds a flat bonus to speed", async () => {
          const actor = await createTestCharacter()

          await addModifier(actor, "system.modifiers.speed", 30)

          await withBasic(() => {
            assert.strictEqual(actor.system.speed.exploration, 150)
          })
        })

        it("keeps a halted character halted despite a speed bonus", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            { type: "weapon", name: "Anvil", system: { weight: 2000 } },
            actor,
          )
          await addModifier(actor, "system.modifiers.speed", 30)

          await withDetailed(() => {
            // Over the maximum load the multiplier zeroes the speed out, and a
            // flat bonus must not push it back above nothing.
            assert.strictEqual(actor.system.speed.exploration, 0)
          })
        })
      })
    },
    { displayName: "BAGS: Character encumbrance" },
  )
}
