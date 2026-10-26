/**
 * @file Integration tests for BAGS' configuration wiring.
 *
 * These tests are about the seams between the system and Foundry: is every rules
 * module registered, does every setting resolve to a real module, and does every
 * document type BAGS declares actually have a data model and a sheet behind it?
 *
 * None of that can be checked outside a running world, and all of it fails
 * loudly and confusingly at runtime when it breaks -- a missing data model shows
 * up as a sheet full of `undefined`, not as an error.
 */

import { SYSTEM_NAME } from "../../config/constants.mjs"
import BAGSActor from "../../actors/actor.document.mjs"
import BAGSItem from "../../items/item.document.mjs"
import BAGSChatMessage from "../../chat/chat-message.document.mjs"
import BAGSActorSheet from "../../actors/actor.sheet.mjs"
import BAGSBaseItemSheet from "../../items/item.sheet.mjs"

/**
 * Actor types declared in `system.json` that don't have a data model yet.
 *
 * Vehicles are declared so the type exists, but nothing has been built for them.
 * Keeping the gap listed here rather than silently skipping it means the test
 * fails the moment someone adds a new type without a model -- and also when
 * vehicles finally get one, which is the reminder to delete this line.
 * @type {string[]}
 */
const ACTOR_TYPES_WITHOUT_DATA_MODELS = ["vehicle"]

/**
 * Register the configuration test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerRegistryTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.system.registry",
    (context) => {
      const { describe, it, assert } = context

      const registry = () => CONFIG.BAGS.SystemRegistry
      const categories = () => Object.values(registry().categories)

      /**
       * Document subtypes BAGS declares, minus Foundry's own base type.
       * @param {string} documentName - "Actor", "Item", or "ChatMessage"
       * @returns {string[]} The declared subtypes
       */
      const declaredTypes = (documentName) =>
        game.documentTypes[documentName].filter(
          (type) => type !== CONST.BASE_DOCUMENT_TYPE,
        )

      describe("SystemRegistry", () => {
        it("is exposed on CONFIG for modules to extend", () => {
          assert.isObject(CONFIG.BAGS, "CONFIG.BAGS should exist")
          assert.isFunction(
            registry().register,
            "the registry should expose register()",
          )
        })

        it("has at least one rules module in every category", () => {
          categories().forEach((category) => {
            assert.isAbove(
              registry().getAll(category).length,
              0,
              `${category} has no registered rules modules`,
            )
          })
        })

        it("has exactly one default rules module per category", () => {
          categories().forEach((category) => {
            const defaults = registry()
              .getAll(category)
              .filter((component) => component.default)

            assert.lengthOf(
              defaults,
              1,
              `${category} should have exactly one default, found ${defaults
                .map((c) => c.id)
                .join(", ")}`,
            )
          })
        })

        it("gives every rules module an id and a name", () => {
          categories().forEach((category) => {
            registry()
              .getAll(category)
              .forEach((component) => {
                assert.isString(
                  component.id,
                  `a ${category} module is missing an id`,
                )
                assert.isString(
                  component.name,
                  `${category} module "${component.id}" is missing a name`,
                )
              })
          })
        })

        it("looks up a module by category and id", () => {
          const [first] = registry().getAll(registry().categories.COMBAT)

          assert.strictEqual(
            registry().get(registry().categories.COMBAT, first.id),
            first,
          )
        })

        it("refuses to register into a category that doesn't exist", () => {
          assert.throws(
            () => registry().register("NotACategory", { id: "nope" }),
            /Invalid category/,
          )
        })

        it("refuses to register a module with no id", () => {
          assert.throws(
            () => registry().register(registry().categories.COMBAT, {}),
            /must have an id/,
          )
        })
      })

      describe("Rules settings", () => {
        it("registers a selection setting for every category", () => {
          categories().forEach((category) => {
            assert.isTrue(
              game.settings.settings.has(`${SYSTEM_NAME}.selected${category}`),
              `no setting registered for ${category}`,
            )
          })
        })

        it("resolves every selection setting to a registered module", () => {
          categories().forEach((category) => {
            const selected = registry().getSelectedOfCategory(category)

            assert.isOk(
              selected,
              `${category} setting does not resolve to a rules module`,
            )
            assert.strictEqual(
              selected.id,
              game.settings.get(SYSTEM_NAME, `selected${category}`),
            )
          })
        })

        it("offers every registered module as a setting choice", () => {
          categories().forEach((category) => {
            const setting = game.settings.settings.get(
              `${SYSTEM_NAME}.selected${category}`,
            )
            const registered = registry()
              .getAll(category)
              .map((component) => component.id)
              .sort()

            assert.deepEqual(
              Object.keys(setting.choices).sort(),
              registered,
              `${category} choices don't match what's registered`,
            )
          })
        })

        it("registers the character creation settings", () => {
          const keys = [
            "characterCreationSources",
            "characterCreationMode",
            "characterCreationStartingGold",
            "tags",
          ]

          keys.forEach((key) => {
            assert.isTrue(
              game.settings.settings.has(`${SYSTEM_NAME}.${key}`),
              `${key} is not registered`,
            )
          })
        })

        it("gives every source category a place in the sources setting", () => {
          const sources = game.settings.get(
            SYSTEM_NAME,
            "characterCreationSources",
          )

          // The creation flow reads these keys directly; a missing one silently
          // drops that step from the wizard.
          const expected = [
            "classes",
            "equipment",
            "identity",
            "spells",
            "abilities",
          ]

          expected.forEach((key) => {
            assert.property(sources, key)
          })
        })
      })

      describe("Rules module interfaces", () => {
        it("gives every combat module the fields the resolvers read", () => {
          registry()
            .getAll(registry().categories.COMBAT)
            .forEach((combat) => {
              assert.isNumber(combat.baseAC, `${combat.id} has no baseAC`)
              assert.isBoolean(
                combat.descending,
                `${combat.id} does not declare descending`,
              )
              assert.isFunction(
                combat.resolveAttackRoll,
                `${combat.id} cannot resolve attack rolls`,
              )
            })
        })

        it("gives every encumbrance module its calculation functions", () => {
          registry()
            .getAll(registry().categories.ENCUMBRANCE)
            .forEach((encumbrance) => {
              assert.isFunction(
                encumbrance.calculateEncumbrance,
                `${encumbrance.id} cannot calculate encumbrance`,
              )
              assert.isFunction(
                encumbrance.getEncumbranceThresholds,
                `${encumbrance.id} has no thresholds`,
              )
              assert.isFunction(
                encumbrance.getSpeedCategories,
                `${encumbrance.id} has no speed categories`,
              )
            })
        })

        it("gives every saving throw module saves and a resolver", () => {
          registry()
            .getAll(registry().categories.SAVING_THROWS)
            .forEach((saves) => {
              assert.isNotEmpty(
                Object.keys(saves.savingThrows ?? {}),
                `${saves.id} defines no saving throws`,
              )
              assert.isFunction(
                saves.resolve,
                `${saves.id} cannot resolve a saving throw`,
              )
            })
        })

        it("gives every ability score a label and a modifier table", () => {
          const { abilityScores } = registry().getSelectedOfCategory(
            registry().categories.ABILITY_SCORES,
          )

          assert.instanceOf(abilityScores, Map)
          assert.isNotEmpty(Array.from(abilityScores.keys()))

          abilityScores.forEach((score, key) => {
            assert.isString(score.label, `${key} has no label`)
            assert.instanceOf(
              score.modifiers,
              Map,
              `${key} has no modifier table`,
            )
            // Every score in the 3-18 range needs an entry, or a rolled score
            // lands on `undefined` and the character sheet breaks.
            assert.isOk(
              score.modifiers.get(3),
              `${key} has no modifiers for a score of 3`,
            )
            assert.isOk(
              score.modifiers.get(18),
              `${key} has no modifiers for a score of 18`,
            )
          })
        })

        it("gives the initiative modules a formula", () => {
          registry()
            .getAll(registry().categories.INITIATIVE)
            .forEach((initiative) => {
              assert.isString(
                initiative.formula,
                `${initiative.id} has no formula`,
              )
            })
        })
      })

      describe("Document configuration", () => {
        it("registers a data model for every Item type", () => {
          declaredTypes("Item").forEach((type) => {
            assert.isFunction(
              CONFIG.Item.dataModels[type],
              `Item type "${type}" has no data model`,
            )
          })
        })

        it("registers a data model for every implemented Actor type", () => {
          const missing = declaredTypes("Actor").filter(
            (type) => !CONFIG.Actor.dataModels[type],
          )

          assert.deepEqual(
            missing.sort(),
            [...ACTOR_TYPES_WITHOUT_DATA_MODELS].sort(),
            "the set of Actor types without data models has changed",
          )
        })

        it("registers a data model for every ChatMessage type", () => {
          declaredTypes("ChatMessage").forEach((type) => {
            assert.isFunction(
              CONFIG.ChatMessage.dataModels[type],
              `ChatMessage type "${type}" has no data model`,
            )
          })
        })

        it("overrides the Actor, Item and ChatMessage document classes", () => {
          // Compared by identity rather than by name: a production build
          // minifies class names, so `BAGSActor.name` is two letters there.
          assert.strictEqual(CONFIG.Actor.documentClass, BAGSActor)
          assert.strictEqual(CONFIG.Item.documentClass, BAGSItem)
          assert.strictEqual(CONFIG.ChatMessage.documentClass, BAGSChatMessage)
        })
      })

      describe("Sheet registration", () => {
        /**
         * The sheet class Foundry would open for a given subtype.
         *
         * Mirrors the resolution order in `ClientDocument#_getSheetClass`, so
         * this is the sheet a player would actually see rather than whichever
         * one happens to be registered first.
         * @param {string} documentName - "Actor" or "Item"
         * @param {string} type - The document subtype
         * @returns {Function|undefined} The default sheet class
         */
        const defaultSheet = (documentName, type) => {
          const classes = Object.values(
            CONFIG[documentName].sheetClasses[type] || {},
          )
          if (!classes.length) return undefined

          const entry =
            classes.find((sheet) => sheet.default) ??
            classes.find((sheet) => sheet.canBeDefault) ??
            classes[classes.length - 1]

          return entry?.cls
        }

        /**
         * Whether a class is, or descends from, one of the system's base sheets.
         *
         * Checked structurally rather than by name, because a production build
         * minifies class names and `/^BAGS/` matches nothing there.
         * @param {Function} sheet - The sheet class to check
         * @param {Function} base - The base class it should descend from
         * @returns {boolean} True when the sheet is one of ours
         */
        const descendsFrom = (sheet, base) =>
          sheet === base || sheet?.prototype instanceof base

        it("gives every Item type a BAGS sheet by default", () => {
          declaredTypes("Item").forEach((type) => {
            const sheet = defaultSheet("Item", type)

            assert.isFunction(sheet, `Item type "${type}" has no default sheet`)
            assert.isTrue(
              descendsFrom(sheet, BAGSBaseItemSheet),
              `Item type "${type}" defaults to a sheet that isn't ours`,
            )
          })
        })

        it("gives every Actor type with a data model a BAGS sheet", () => {
          declaredTypes("Actor")
            .filter((type) => CONFIG.Actor.dataModels[type])
            .forEach((type) => {
              const sheet = defaultSheet("Actor", type)

              assert.isFunction(
                sheet,
                `Actor type "${type}" has no default sheet`,
              )
              assert.isTrue(
                descendsFrom(sheet, BAGSActorSheet),
                `Actor type "${type}" defaults to a sheet that isn't ours`,
              )
            })
        })
      })
    },
    { displayName: "BAGS: Registry and configuration" },
  )
}
