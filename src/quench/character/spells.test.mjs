/**
 * @file Integration tests for spell preparation.
 *
 * Preparation is the one place where a rule is enforced against a limit that
 * comes from somewhere else entirely: the number of slots lives on the class
 * Item's spell slot table, the spells live as Items on the character, and the
 * prepared list is an array of Item IDs on the character. Nothing about that can
 * be checked without all three documents actually existing.
 */

import {
  captureRejection,
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
} from "../helpers.mjs"

/**
 * Register the spell preparation test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSpellTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.spells",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * Add a spell of a given level to a character.
       * @param {Actor} actor - The character learning the spell
       * @param {number} level - The spell's level
       * @param {string} [name] - The spell's name
       * @returns {Promise<Item>} The created spell Item
       */
      const createSpell = (actor, level, name = `Level ${level} Spell`) =>
        createTestItem({ type: "spell", name, system: { level } }, actor)

      /**
       * Build a caster with a known slot table.
       * @param {number[][]} spellSlots - Slots as [spellLevel][characterLevel]
       * @param {number} [level] - The character's class level
       * @returns {Promise<Actor>} The prepared character
       */
      const createCaster = async (spellSlots, level = 1) => {
        const actor = await createTestCharacter()
        await createTestClass({
          levels: Math.max(level, 1),
          level,
          actor,
          spellSlots,
        })
        return actor
      }

      describe("Slot availability", function slots() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("reports the slots a caster has at their level", async () => {
          const actor = await createCaster(
            [
              [1, 2],
              [null, 1],
            ],
            2,
          )

          assert.strictEqual(actor.system.spellSlots[0], 2)
          assert.strictEqual(actor.system.spellSlots[1], 1)
        })

        it("gives a first level caster no second level slots", async () => {
          const actor = await createCaster([[1], [0]], 1)

          assert.strictEqual(actor.system.spellSlots[0], 1)
          assert.isNotOk(actor.system.spellSlots[1])
        })
      })

      describe("Preparing spells", function preparing() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("prepares a spell into an available slot", async () => {
          const actor = await createCaster([[2]])
          const spell = await createSpell(actor, 1)

          await actor.prepareSpell(spell.id)

          assert.include(actor.system.preparedSpells, spell.id)
        })

        it("fills every slot at a level", async () => {
          const actor = await createCaster([[2]])
          const first = await createSpell(actor, 1, "Sleep")
          const second = await createSpell(actor, 1, "Charm")

          await actor.prepareSpell(first.id)
          await actor.prepareSpell(second.id)

          assert.lengthOf(actor.system.preparedSpells, 2)
        })

        it("refuses to prepare past the slots available", async () => {
          const actor = await createCaster([[1]])
          const first = await createSpell(actor, 1, "Sleep")
          const second = await createSpell(actor, 1, "Charm")

          await actor.prepareSpell(first.id)

          const error = await captureRejection(() =>
            actor.prepareSpell(second.id),
          )

          assert.isOk(error, "a full slot level should refuse another spell")
          assert.strictEqual(error.message, "BAGS.SpellManager.SlotsFull")
          assert.lengthOf(actor.system.preparedSpells, 1)
        })

        it("counts slots per spell level, not in total", async () => {
          const actor = await createCaster(
            [
              [1, 1],
              [null, 1],
            ],
            2,
          )
          const firstLevel = await createSpell(actor, 1, "Sleep")
          const secondLevel = await createSpell(actor, 2, "Web")

          await actor.prepareSpell(firstLevel.id)
          // The first level slot is spent, but the second level one isn't.
          await actor.prepareSpell(secondLevel.id)

          assert.lengthOf(actor.system.preparedSpells, 2)
        })

        it("refuses to prepare anything without a caster class", async () => {
          const actor = await createTestCharacter()
          const spell = await createSpell(actor, 1)

          const error = await captureRejection(() =>
            actor.prepareSpell(spell.id),
          )

          assert.isOk(error, "a non-caster should have no slots to fill")
        })

        it("takes a prepared spell back off the list", async () => {
          const actor = await createCaster([[2]])
          const first = await createSpell(actor, 1, "Sleep")
          const second = await createSpell(actor, 1, "Charm")

          await actor.prepareSpell(first.id)
          await actor.prepareSpell(second.id)
          await actor.unprepareSpell(first.id)

          assert.notInclude(actor.system.preparedSpells, first.id)
          assert.include(
            actor.system.preparedSpells,
            second.id,
            "unpreparing one spell should leave the other alone",
          )
        })

        it("frees the slot up again after unpreparing", async () => {
          const actor = await createCaster([[1]])
          const first = await createSpell(actor, 1, "Sleep")
          const second = await createSpell(actor, 1, "Charm")

          await actor.prepareSpell(first.id)
          await actor.unprepareSpell(first.id)
          await actor.prepareSpell(second.id)

          assert.deepEqual(actor.system.preparedSpells, [second.id])
        })
      })

      describe("Grouping spells", function grouping() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("groups a caster's known spells by level", async () => {
          const actor = await createCaster([[2], [1]], 1)
          await createSpell(actor, 1, "Sleep")
          await createSpell(actor, 1, "Charm")
          await createSpell(actor, 2, "Web")

          const byLevel = actor.system.availableSpellsByLevel

          assert.lengthOf(byLevel.get(1), 2)
          assert.lengthOf(byLevel.get(2), 1)
        })

        it("groups prepared spells by level", async () => {
          const actor = await createCaster([[2]])
          const sleep = await createSpell(actor, 1, "Sleep")
          await createSpell(actor, 1, "Charm")

          await actor.prepareSpell(sleep.id)

          const byLevel = actor.system.preparedSpellsByLevel

          assert.lengthOf(byLevel.get(1), 1)
          assert.strictEqual(byLevel.get(1)[0].id, sleep.id)
        })

        it("ignores a prepared spell that has been deleted", async () => {
          const actor = await createCaster([[2]])
          const sleep = await createSpell(actor, 1, "Sleep")

          await actor.prepareSpell(sleep.id)
          await sleep.delete()

          // The stale ID is still on the list; the grouping getter has to cope.
          assert.strictEqual(actor.system.preparedSpellsByLevel.size, 0)
        })
      })
    },
    { displayName: "BAGS: Character spell preparation" },
  )
}
