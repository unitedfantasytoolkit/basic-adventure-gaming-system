/**
 * @file Integration tests for the character creation flow itself.
 *
 * The pure parts of this flow -- which steps a set of sources produces, whether a
 * class is a legal choice, what formula the starting money uses -- already have
 * unit tests in `test/character-creation-helpers.test.mjs`. What can't be tested
 * from the command line is everything the flow does with the world: rolling real
 * dice, and writing every choice onto the Actor at the end.
 *
 * That last part is the reason this batch exists. Completion is the only place in
 * the system where one action creates Items, updates a document and rolls dice in
 * a particular order, and the ordering matters: hit points can't be rolled until
 * the class Item that supplies the hit dice is there.
 *
 * Where the choices come from is `./creation-sources.test.mjs`; whether the flow
 * is offered at all is `./creation-offer.test.mjs`.
 */

import {
  captureChatMessages,
  captureNotifications,
  cleanUpDocuments,
  closeApplication,
  createBlankCharacter,
  createTestCharacter,
  createTestClass,
  createTestItem,
  renderApplication,
  trackDocument,
  waitFor,
  withFixedDice,
  withSetting,
} from "../helpers.mjs"
import BAGSCharacterCreation from "../../actors/actor.character.creation.mjs"
import { isSheetHeld } from "../../actors/actor.character.creation-gate.mjs"

/** Source lists with nothing configured, as a starting point for overrides. */
const NO_SOURCES = {
  classes: [],
  equipment: [],
  identity: [],
  spells: [],
  abilities: [],
}

/**
 * Register the character creation test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerCharacterCreationTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.creation",
    (context) => {
      const { describe, it, assert, after } = context

      // === Local fixtures ====================================================

      /**
       * Create a Folder that will be cleaned up after the suite.
       * @param {string} [name] - The folder's name
       * @returns {Promise<Folder>} The created Folder
       */
      const createItemFolder = async (name = "[Quench] Sources") =>
        trackDocument(
          await getDocumentClass("Folder").create({ name, type: "Item" }),
        )

      /**
       * Build a `characterCreationSources` value with one folder in a category.
       * @param {string} category - The source category
       * @param {Folder} folder - The folder to point it at
       * @returns {object} A complete sources setting
       */
      const folderSources = (category, folder) => ({
        ...NO_SOURCES,
        [category]: [{ id: folder.id, type: "folder" }],
      })

      /**
       * Run a callback against a rendered creation flow, then tidy up.
       *
       * The flow re-renders itself after every choice, so it has to be rendered
       * for those calls to be doing what they do in earnest. Closing it hands the
       * player the Actor's own sheet, which is why that gets closed too.
       * @param {Actor} actor - The Actor to build
       * @param {(app: BAGSCharacterCreation) => Promise<void>} callback - The test
       * @returns {Promise<void>} Resolves once everything is closed again
       */
      const withCreationFlow = async (actor, callback) => {
        const app = new BAGSCharacterCreation({ document: actor })

        try {
          await renderApplication(app)
          await callback(app)
        } finally {
          await closeApplication(app)
          if (actor.sheet?.rendered) await closeApplication(actor.sheet)
        }
      }

      // === Steps =============================================================

      describe("Which steps a world offers", function steps() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("always offers scores and details, even with nothing configured", async () => {
          const actor = await createTestCharacter()

          await withSetting("characterCreationSources", NO_SOURCES, () => {
            const app = new BAGSCharacterCreation({ document: actor })

            assert.deepEqual(app.activeSteps, ["scores", "details"])
          })
        })

        it("adds a step for each configured category", async () => {
          const actor = await createTestCharacter()
          const folder = await createItemFolder()

          await withSetting(
            "characterCreationSources",
            folderSources("classes", folder),
            () => {
              const app = new BAGSCharacterCreation({ document: actor })

              assert.deepEqual(app.activeSteps, ["scores", "class", "details"])
            },
          )
        })

        it("offers spells only to a class that casts at first level", async () => {
          const actor = await createTestCharacter()
          const classFolder = await createItemFolder("[Quench] Classes")
          const spellFolder = await createItemFolder("[Quench] Spells")
          const fighter = await createTestClass({
            data: { name: "Fighter", folder: classFolder.id },
          })
          const magician = await createTestClass({
            spellSlots: [[1, 2]],
            data: { name: "Magician", folder: classFolder.id },
          })

          const configured = {
            ...NO_SOURCES,
            classes: [{ id: classFolder.id, type: "folder" }],
            spells: [{ id: spellFolder.id, type: "folder" }],
          }

          await withSetting(
            "characterCreationSources",
            configured,
            async () => {
              const app = new BAGSCharacterCreation({ document: actor })

              assert.notInclude(
                app.activeSteps,
                "spells",
                "there is no spell step before a class is chosen",
              )

              await withCreationFlow(actor, async (flow) => {
                await flow.chooseClass(fighter.uuid)
                assert.notInclude(flow.activeSteps, "spells")

                await flow.chooseClass(magician.uuid)
                assert.include(flow.activeSteps, "spells")
              })
            },
          )
        })
      })

      // === Ability scores ====================================================

      describe("Rolling ability scores", function abilityScores() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("rolls every score the rules module defines", async () => {
          const actor = await createBlankCharacter({
            name: "[Quench] Unrolled",
          })

          await withSetting("characterCreationSources", NO_SOURCES, () =>
            withCreationFlow(actor, async (flow) => {
              assert.isFalse(flow.hasAllAbilityScores)

              await withFixedDice("max", () => flow.rollAllAbilityScores())

              assert.isTrue(flow.hasAllAbilityScores)
            }),
          )
        })

        it("leaves the Actor alone until the flow is finished", async () => {
          const actor = await createBlankCharacter({
            name: "[Quench] Unrolled",
          })

          await withSetting("characterCreationSources", NO_SOURCES, () =>
            withCreationFlow(actor, async (flow) => {
              await withFixedDice("max", () => flow.rollAllAbilityScores())

              assert.strictEqual(
                actor.system.base.abilityScores.str,
                0,
                "nothing should be written until the last step is confirmed",
              )
            }),
          )
        })

        it("cannot finish before every score is set", async () => {
          const actor = await createBlankCharacter({
            name: "[Quench] Unrolled",
          })

          await withSetting("characterCreationSources", NO_SOURCES, () =>
            withCreationFlow(actor, async (flow) => {
              assert.isFalse(flow.canFinish)
              assert.include(
                flow.missingRequirements,
                "BAGS.CharacterCreation.Requirements.AbilityScores",
              )

              await withFixedDice("max", () => flow.rollAllAbilityScores())

              assert.isTrue(flow.canFinish)
            }),
          )
        })

        it("needs a class as well, when the world supplies classes", async () => {
          const actor = await createBlankCharacter({
            name: "[Quench] Unrolled",
          })
          const folder = await createItemFolder()
          const fighter = await createTestClass({
            data: { name: "Fighter", folder: folder.id },
          })

          await withSetting(
            "characterCreationSources",
            folderSources("classes", folder),
            () =>
              withCreationFlow(actor, async (flow) => {
                await withFixedDice("max", () => flow.rollAllAbilityScores())

                assert.isFalse(flow.canFinish)
                assert.include(
                  flow.missingRequirements,
                  "BAGS.CharacterCreation.Requirements.Class",
                )

                await flow.chooseClass(fighter.uuid)

                assert.isTrue(flow.canFinish)
              }),
          )
        })
      })

      // === Completion ========================================================

      describe("Finishing", function finishing() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        it("writes the rolled scores onto the Actor", async () => {
          const actor = await createBlankCharacter({ name: "[Quench] Recruit" })

          await withSetting("characterCreationSources", NO_SOURCES, () =>
            withCreationFlow(actor, async (flow) => {
              await withFixedDice("max", async () => {
                await flow.rollAllAbilityScores()
                await flow.complete()
              })

              // 3d6 with every die showing its highest face.
              assert.strictEqual(actor.system.base.abilityScores.str, 18)
              assert.strictEqual(actor.system.base.abilityScores.con, 18)
            }),
          )
        })

        it("creates the chosen class and rolls hit points from it", async () => {
          const actor = await createBlankCharacter({ name: "[Quench] Recruit" })
          const folder = await createItemFolder()
          const fighter = await createTestClass({
            hitDieSize: 8,
            data: { name: "Fighter", folder: folder.id },
          })

          await withSetting(
            "characterCreationSources",
            folderSources("classes", folder),
            () =>
              withCreationFlow(actor, async (flow) => {
                await withFixedDice("max", async () => {
                  await flow.rollAllAbilityScores()
                  await flow.chooseClass(fighter.uuid)
                  await flow.complete()
                })

                assert.lengthOf(actor.itemTypes.class, 1)
                assert.strictEqual(actor.itemTypes.class[0].name, "Fighter")

                // A d8 showing 8, plus 3 for a constitution of 18. Hit points
                // can only be rolled after the class Item exists, so this
                // number is also proof of the ordering inside `complete()`.
                assert.strictEqual(actor.system.hp.max, 11)
                assert.strictEqual(actor.system.hp.value, 11)
              }),
          )
        })

        it("copies the chosen ancestry onto the Actor", async () => {
          const actor = await createBlankCharacter({ name: "[Quench] Recruit" })
          const folder = await createItemFolder()
          const dwarf = await createTestItem({
            type: "identity",
            name: "Dwarf",
            folder: folder.id,
          })

          await withSetting(
            "characterCreationSources",
            folderSources("identity", folder),
            () =>
              withCreationFlow(actor, async (flow) => {
                await withFixedDice("max", async () => {
                  await flow.rollAllAbilityScores()
                  await flow.chooseIdentity(dwarf.uuid)
                  await flow.complete()
                })

                assert.lengthOf(actor.itemTypes.identity, 1)
                assert.strictEqual(actor.itemTypes.identity[0].name, "Dwarf")
                assert.notStrictEqual(
                  actor.itemTypes.identity[0].id,
                  dwarf.id,
                  "the Actor should get its own copy, not the source Item",
                )
              }),
          )
        })

        it("refuses to finish while something required is missing", async () => {
          const actor = await createBlankCharacter({ name: "[Quench] Recruit" })

          await withSetting("characterCreationSources", NO_SOURCES, () =>
            withCreationFlow(actor, async (flow) => {
              await flow.complete()

              assert.strictEqual(
                actor.system.base.abilityScores.str,
                0,
                "an incomplete flow should write nothing at all",
              )
            }),
          )
        })

        it("leaves the Actor untouched when the window is closed early", async () => {
          const actor = await createBlankCharacter({
            name: "[Quench] Deserter",
          })

          await withSetting("characterCreationSources", NO_SOURCES, () =>
            withCreationFlow(actor, async (flow) => {
              await withFixedDice("max", () => flow.rollAllAbilityScores())
            }),
          )

          assert.strictEqual(actor.system.base.abilityScores.str, 0)
          assert.strictEqual(actor.itemTypes.class.length, 0)
        })

        it("hands the player the character sheet on the way out", async () => {
          const actor = await createBlankCharacter({
            name: "[Quench] Deserter",
          })
          const app = new BAGSCharacterCreation({ document: actor })

          try {
            await renderApplication(app)
            await closeApplication(app)

            await waitFor(
              () => actor.sheet?.rendered,
              "the character sheet to open behind the closed flow",
            )

            assert.isFalse(isSheetHeld(actor))
          } finally {
            if (actor.sheet?.rendered) await closeApplication(actor.sheet)
          }
        })
      })

      // === Starting money and equipment ======================================

      describe("Buying equipment", function equipment() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        /**
         * Configure an equipment folder with one item in it.
         * @param {number} cost - What the item should cost
         * @returns {Promise<{folder: Folder, item: Item}>} The fixtures
         */
        const shopWith = async (cost) => {
          const folder = await createItemFolder("[Quench] Shop")
          const item = await createTestItem({
            type: "item",
            name: "Ten Foot Pole",
            folder: folder.id,
            system: { cost },
          })

          return { folder, item }
        }

        it("rolls starting money and reports it to the table", async () => {
          const actor = await createTestCharacter()
          const { folder } = await shopWith(1)

          await withSetting(
            "characterCreationSources",
            folderSources("equipment", folder),
            () =>
              withSetting("characterCreationStartingGold", "3d6 * 10", () =>
                withCreationFlow(actor, async (flow) => {
                  assert.include(
                    flow.activeSteps,
                    "equipment",
                    "an equipment source should produce an equipment step",
                  )

                  const { messages } = await captureChatMessages(() =>
                    withFixedDice("max", () => flow.rollStartingGold()),
                  )

                  assert.lengthOf(
                    messages,
                    1,
                    "the roll is posted so the table can see it wasn't fudged",
                  )
                  // Three sixes, times ten.
                  assert.strictEqual(messages[0].rolls[0].total, 180)
                }),
              ),
          )
        })

        it("refuses to buy what the character can't afford", async () => {
          const actor = await createBlankCharacter({ name: "[Quench] Pauper" })
          const { folder, item } = await shopWith(500)

          await withSetting(
            "characterCreationSources",
            folderSources("equipment", folder),
            () =>
              withCreationFlow(actor, async (flow) => {
                const { warnings } = await captureNotifications(async () => {
                  await withFixedDice("max", () => flow.rollAllAbilityScores())
                  // No money rolled at all, so nothing is affordable.
                  await flow.addItemToCart(item.uuid, 1)
                  await flow.complete()
                })

                assert.lengthOf(warnings, 1, "the refusal should be reported")
                assert.lengthOf(
                  actor.items.filter((i) => i.name === "Ten Foot Pole"),
                  0,
                  "an unaffordable item should never reach the character",
                )
              }),
          )
        })

        it("creates purchased items with the quantity bought", async () => {
          const actor = await createBlankCharacter({ name: "[Quench] Shopper" })
          const { folder, item } = await shopWith(1)

          await withSetting(
            "characterCreationSources",
            folderSources("equipment", folder),
            () =>
              withSetting("characterCreationStartingGold", "100", () =>
                withCreationFlow(actor, async (flow) => {
                  await withFixedDice("max", async () => {
                    await flow.rollAllAbilityScores()
                    await flow.rollStartingGold()
                    await flow.addItemToCart(item.uuid, 3)
                    await flow.complete()
                  })

                  const bought = actor.items.find(
                    (i) => i.name === "Ten Foot Pole",
                  )

                  assert.isOk(bought, "the purchase should be on the character")
                  assert.strictEqual(bought.system.quantity, 3)
                }),
              ),
          )
        })
      })
    },
    { displayName: "BAGS: Character creation" },
  )
}
