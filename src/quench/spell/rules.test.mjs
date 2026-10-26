/**
 * @file Integration tests for the spell rules modules and spell acquisition.
 *
 * The rules module decides what a spell entry prints, what traditions exist,
 * and how a caster comes by their spells. A caster's spells are Items on their
 * Actor whichever module is in play -- what changes is how they get there.
 */

import {
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
  withRulesModule,
} from "../helpers.mjs"
import {
  getSpellAccess,
  getEntryFields,
  getTradition,
} from "../../config/spell-rules.mjs"
import {
  actorHasSpell,
  castableSpellLevels,
  grantSpellsAtLevel,
  grantsEntireList,
  learnSpell,
} from "../../utils/spell-acquisition.mjs"

/**
 * Register the spell rules test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSpellRulesTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.spell.rules",
    (context) => {
      const { describe, it, assert, after } = context

      const registry = CONFIG.BAGS.SystemRegistry
      const { SPELLS } = registry.categories

      describe("The spell rules modules", function modules() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("registers one module per game", () => {
          const ids = registry.getAll(SPELLS).map((module) => module.id)

          assert.includeMembers(ids, ["basic", "advanced-1e", "advanced-2e"])
        })

        it("makes Basic the default", () => {
          const defaults = registry
            .getAll(SPELLS)
            .filter((candidate) => candidate.default)

          assert.lengthOf(defaults, 1, "exactly one module should be default")
          assert.strictEqual(defaults[0].id, "basic")
        })

        it("gives every module the same tradition ids", () => {
          registry.getAll(SPELLS).forEach((module) => {
            const ids = module.traditions.map((tradition) => tradition.id)

            assert.includeMembers(
              ids,
              ["arcane", "divine"],
              `${module.id} should keep the shared tradition ids so a class configured under one module survives a switch`,
            )
          })
        })

        it("prints less in Basic than in the Advanced games", async () => {
          const basic = await withRulesModule(SPELLS, "basic", () =>
            getEntryFields("arcane"),
          )
          const advanced = await withRulesModule(SPELLS, "advanced-2e", () =>
            getEntryFields("arcane"),
          )

          assert.isBelow(basic.size, advanced.size)
          assert.isTrue(basic.has("range"))
          assert.isFalse(basic.has("castingTime"))
          assert.isTrue(advanced.has("castingTime"))
        })

        it("adds spheres to the divine tradition only, and only in 2nd Edition", async () => {
          await withRulesModule(SPELLS, "advanced-2e", () => {
            assert.isTrue(getEntryFields("divine").has("spheres"))
            assert.isFalse(getEntryFields("arcane").has("spheres"))
          })

          await withRulesModule(SPELLS, "advanced-1e", () => {
            assert.isFalse(getEntryFields("divine").has("spheres"))
          })
        })
      })

      describe("How a class comes by its spells", function access() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("follows the tradition by default", async () => {
          const cleric = await createTestClass({
            data: { name: "Cleric", system: { traditionId: "divine" } },
          })
          const magicUser = await createTestClass({
            data: { name: "Magic-User", system: { traditionId: "arcane" } },
          })

          assert.strictEqual(getSpellAccess(cleric), "full")
          assert.strictEqual(getSpellAccess(magicUser), "repertoire")

          assert.isTrue(grantsEntireList(cleric))
          assert.isFalse(grantsEntireList(magicUser))
        })

        it("lets a class break with its tradition", async () => {
          const bookPriest = await createTestClass({
            data: {
              name: "Book Priest",
              system: { traditionId: "divine", spellAccess: "repertoire" },
            },
          })

          assert.strictEqual(getSpellAccess(bookPriest), "repertoire")
          assert.isFalse(grantsEntireList(bookPriest))
        })

        it("knows which levels a class can currently cast", async () => {
          const cleric = await createTestClass({
            // Slots are [spellLevel][characterLevel], and the class is level 1.
            spellSlots: [[2], [0], [1]],
            data: { name: "Cleric", system: { traditionId: "divine" } },
          })

          assert.deepEqual(castableSpellLevels(cleric), [1, 3])
        })
      })

      describe("Adding spells to a caster", function acquisition() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        /**
         * Build a caster with a class whose list carries some spells.
         * @param {object} options - What to build
         * @param {string} options.traditionId - The class's tradition
         * @param {number[][]} options.spellSlots - Slots by [level][charLevel]
         * @param {Array} options.listed - `{spell, level}` listings
         * @returns {Promise<{actor: Actor, classItem: Item}>} The pieces
         */
        const buildCaster = async ({ traditionId, spellSlots, listed }) => {
          const actor = await createTestCharacter()
          const classItem = await createTestClass({
            actor,
            spellSlots,
            data: {
              name: "Caster",
              system: {
                traditionId,
                spellList: listed.map(({ spell, level }) => ({
                  uuid: spell.uuid,
                  level,
                })),
              },
            },
          })

          return { actor, classItem }
        }

        it("hands a full-access caster every spell of a level", async () => {
          const cure = await createTestItem({
            type: "spell",
            name: "Cure Light Wounds",
            system: { level: 1 },
          })
          const bless = await createTestItem({
            type: "spell",
            name: "Bless",
            system: { level: 1 },
          })
          const silence = await createTestItem({
            type: "spell",
            name: "Silence",
            system: { level: 2 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "divine",
            spellSlots: [[2], [1]],
            listed: [
              { spell: cure, level: 1 },
              { spell: bless, level: 1 },
              { spell: silence, level: 2 },
            ],
          })

          const created = await grantSpellsAtLevel(actor, classItem, 1)

          assert.lengthOf(created, 2, "both first level spells should arrive")

          const names = actor.items.documentsByType.spell.map((s) => s.name)
          assert.includeMembers(names, ["Cure Light Wounds", "Bless"])
          assert.notInclude(
            names,
            "Silence",
            "a second level spell isn't part of a first level grant",
          )
        })

        it("doesn't hand over the same spell twice", async () => {
          const cure = await createTestItem({
            type: "spell",
            name: "Cure Light Wounds",
            system: { level: 1 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "divine",
            spellSlots: [[2]],
            listed: [{ spell: cure, level: 1 }],
          })

          await grantSpellsAtLevel(actor, classItem, 1)
          const second = await grantSpellsAtLevel(actor, classItem, 1)

          assert.lengthOf(second, 0)
          assert.lengthOf(actor.items.documentsByType.spell, 1)
          assert.isTrue(actorHasSpell(actor, cure))
        })

        it("refuses a spell of a level the caster can't reach", async () => {
          const fireball = await createTestItem({
            type: "spell",
            name: "Fireball",
            system: { level: 3 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "arcane",
            spellSlots: [[1]],
            listed: [{ spell: fireball, level: 3 }],
          })

          const result = await withRulesModule(SPELLS, "basic", () =>
            learnSpell(actor, fireball, classItem),
          )

          assert.isFalse(result.added)
          assert.strictEqual(
            result.reason,
            "BAGS.Items.Spells.Learning.LevelTooHigh",
          )
          assert.lengthOf(actor.items.documentsByType.spell, 0)
        })

        it("learns a spell without a roll under the Basic rules", async () => {
          const sleep = await createTestItem({
            type: "spell",
            name: "Sleep",
            system: { level: 1 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "arcane",
            spellSlots: [[1]],
            listed: [{ spell: sleep, level: 1 }],
          })

          const result = await withRulesModule(SPELLS, "basic", () =>
            learnSpell(actor, sleep, classItem),
          )

          assert.isTrue(result.added)
          assert.isUndefined(result.roll, "Basic has nothing to roll")
          assert.lengthOf(actor.items.documentsByType.spell, 1)
        })

        it("rolls to learn under the Advanced rules", async () => {
          const sleep = await createTestItem({
            type: "spell",
            name: "Sleep",
            system: { level: 1 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "arcane",
            spellSlots: [[1]],
            listed: [{ spell: sleep, level: 1 }],
          })

          await actor.update({ "system.base.abilityScores.int": 18 })

          const result = await withRulesModule(SPELLS, "advanced-2e", () =>
            learnSpell(actor, sleep, classItem),
          )

          assert.isOk(result.roll, "an arcane caster rolls to learn")
          assert.strictEqual(result.chance, 65, "18 Intelligence learns on 65%")
          assert.strictEqual(
            result.added,
            result.roll.total <= 65,
            "the roll should decide the outcome",
          )
        })

        it("refuses an arcane caster too dull to learn spells", async () => {
          const sleep = await createTestItem({
            type: "spell",
            name: "Sleep",
            system: { level: 1 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "arcane",
            spellSlots: [[1]],
            listed: [{ spell: sleep, level: 1 }],
          })

          await actor.update({ "system.base.abilityScores.int": 5 })

          const result = await withRulesModule(SPELLS, "advanced-2e", () =>
            learnSpell(actor, sleep, classItem),
          )

          assert.isFalse(result.added)
          assert.strictEqual(
            result.reason,
            "BAGS.Items.Spells.Learning.CannotLearnSpells",
          )
        })

        it("doesn't make a divine caster roll under the Advanced rules", async () => {
          const bless = await createTestItem({
            type: "spell",
            name: "Bless",
            system: { level: 1 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "divine",
            spellSlots: [[1]],
            listed: [{ spell: bless, level: 1 }],
          })

          await actor.update({ "system.base.abilityScores.int": 3 })

          const result = await withRulesModule(SPELLS, "advanced-2e", () =>
            learnSpell(actor, bless, classItem),
          )

          assert.isTrue(
            result.added,
            "a priest's Intelligence has nothing to do with it",
          )
          assert.isUndefined(result.roll)
        })

        it("refuses a spell the caster already has", async () => {
          const sleep = await createTestItem({
            type: "spell",
            name: "Sleep",
            system: { level: 1 },
          })

          const { actor, classItem } = await buildCaster({
            traditionId: "arcane",
            spellSlots: [[1]],
            listed: [{ spell: sleep, level: 1 }],
          })

          await withRulesModule(SPELLS, "basic", () =>
            learnSpell(actor, sleep, classItem),
          )
          const second = await withRulesModule(SPELLS, "basic", () =>
            learnSpell(actor, sleep, classItem),
          )

          assert.isFalse(second.added)
          assert.strictEqual(
            second.reason,
            "BAGS.Items.Spells.Learning.AlreadyKnown",
          )
        })
      })

      describe("A spell's level for the creature casting it", function levels() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("uses the level its class's list gives it", async () => {
          const sleep = await createTestItem({
            type: "spell",
            name: "Sleep",
            system: { level: 1 },
          })

          const actor = await createTestCharacter()
          await createTestClass({
            actor,
            data: {
              name: "Elf",
              system: {
                traditionId: "arcane",
                spellList: [{ uuid: sleep.uuid, level: 3 }],
              },
            },
          })

          const [owned] = await actor.createEmbeddedDocuments("Item", [
            sleep.toObject(),
          ])

          // The owned copy has its own UUID, so the list is matched on the
          // source spell -- which is what the class actually listed.
          assert.strictEqual(actor.system.spellLevelFor(sleep), 3)
          assert.strictEqual(
            actor.system.spellLevelFor(owned),
            1,
            "a copy the class never listed falls back to its printed level",
          )
        })

        it("falls back for a class that lists nothing", async () => {
          const bless = await createTestItem({
            type: "spell",
            name: "Bless",
            system: { level: 2 },
          })

          const actor = await createTestCharacter()
          await createTestClass({
            actor,
            data: { name: "Cleric", system: { traditionId: "divine" } },
          })

          assert.strictEqual(actor.system.spellLevelFor(bless), 2)
        })

        it("gives a classless creature the spell's own level", async () => {
          const bless = await createTestItem({
            type: "spell",
            name: "Bless",
            system: { level: 2 },
          })

          const actor = await createTestCharacter()

          assert.strictEqual(actor.system.spellLevelFor(bless), 2)
        })
      })

      describe("Traditions", function traditions() {
        this.timeout(20000)

        it("resolves a known tradition", async () => {
          await withRulesModule(SPELLS, "basic", () => {
            assert.strictEqual(getTradition("divine")?.id, "divine")
          })
        })

        it("answers null for one this ruleset doesn't have", async () => {
          await withRulesModule(SPELLS, "basic", () => {
            assert.isNull(getTradition("psionic"))
            assert.isNull(getTradition(""))
          })
        })
      })
    },
    { displayName: "BAGS: Spell rules" },
  )
}
