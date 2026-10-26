/**
 * @file Integration tests for creating BAGS documents.
 *
 * BAGS builds its schemas from whatever rules modules the world has selected, so
 * a schema only exists once settings are live. That makes "can you actually
 * create one of these?" a question only a running world can answer, and a
 * question worth asking: a schema that throws on construction takes the whole
 * system down at init, and one that quietly drops a field shows up much later as
 * a sheet that won't save.
 */

import {
  captureRejection,
  cleanUpDocuments,
  createBlankCharacter,
  createTestActor,
  createTestCharacter,
  createTestClass,
  createTestItem,
  getAbilityScoreKeys,
  getSavingThrowKeys,
  TEST_PREFIX,
} from "../helpers.mjs"

/**
 * Register the document creation test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerDocumentTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.system.documents",
    (context) => {
      const { describe, it, assert, after } = context

      /** Item types that represent physical objects and can be equipped. */
      const physicalTypes = ["weapon", "armor", "item"]

      /** Item types that exist only as records on a character. */
      const abstractTypes = ["class", "spell", "ability", "identity"]

      describe("Item creation", function itemCreation() {
        this.timeout(10000)

        after(() => cleanUpDocuments())

        it("creates every declared Item type", async () => {
          const types = [...physicalTypes, ...abstractTypes]

          const items = await Promise.all(
            types.map((type) =>
              createTestItem({ name: `${TEST_PREFIX} ${type}`, type }),
            ),
          )

          items.forEach((item, index) => {
            assert.strictEqual(item.type, types[index])
            assert.instanceOf(
              item.system,
              CONFIG.Item.dataModels[types[index]],
              `${types[index]} did not get its data model`,
            )
          })
        })

        it("marks the physical types as physical", async () => {
          const items = await Promise.all(
            physicalTypes.map((type) => createTestItem({ type })),
          )

          items.forEach((item) => {
            assert.isTrue(item.isPhysical, `${item.type} should be physical`)
            assert.isTrue(
              item.system.isPhysicalItem,
              `${item.type} data model should be physical`,
            )
          })
        })

        it("does not mark abstract types as physical", async () => {
          const items = await Promise.all(
            abstractTypes.map((type) => createTestItem({ type })),
          )

          items.forEach((item) => {
            assert.isFalse(
              item.isPhysical,
              `${item.type} should not be physical`,
            )
          })
        })

        it("gives physical items their stacking and weight defaults", async () => {
          const item = await createTestItem({ type: "item" })

          assert.strictEqual(item.system.quantity, 1)
          assert.strictEqual(item.system.weight, 0)
          assert.isTrue(item.system.isStackable)
          assert.isFalse(item.system.isEquipped)
          assert.isFalse(item.system.container.isContainer)
          assert.isTrue(item.system.identification.isIdentified)
          // Stacking leans on this being unique per item, so it must never be
          // blank on a freshly created item.
          assert.isNotEmpty(item.system.baseItemId)
        })

        it("gives each type its own default artwork", async () => {
          const weapon = await createTestItem({ type: "weapon" })
          const armor = await createTestItem({ type: "armor" })

          assert.include(weapon.img, "item.weapon")
          assert.include(armor.img, "item.armor")
        })

        it("persists an update and reads it back", async () => {
          const item = await createTestItem({ type: "item" })

          await item.update({
            "system.quantity": 7,
            "system.weight": 3,
            "system.countsAsTreasure": true,
          })

          assert.strictEqual(item.system.quantity, 7)
          assert.strictEqual(item.system.weight, 3)
          assert.isTrue(item.system.countsAsTreasure)

          // Read it back off the collection rather than the same instance, to
          // prove the change actually reached the database.
          assert.strictEqual(game.items.get(item.id).system.quantity, 7)
        })

        it("equips and unequips a physical item", async () => {
          const weapon = await createTestItem({ type: "weapon" })

          await weapon.equip()
          assert.isTrue(weapon.system.isEquipped)

          await weapon.unequip()
          assert.isFalse(weapon.system.isEquipped)
        })

        it("refuses to equip a non-physical item", async () => {
          const spell = await createTestItem({ type: "spell" })

          const error = await captureRejection(() => spell.equip())

          assert.isOk(error, "equipping a spell should have thrown")
          assert.match(error.message, /cannot be equipped/)
        })
      })

      describe("Actor creation", function actorCreation() {
        this.timeout(10000)

        after(() => cleanUpDocuments())

        it("creates a character with the selected ability scores", async () => {
          const actor = await createBlankCharacter()

          assert.instanceOf(actor.system, CONFIG.Actor.dataModels.character)
          assert.deepEqual(
            Object.keys(actor.system.base.abilityScores).sort(),
            getAbilityScoreKeys().sort(),
            "the character schema doesn't match the selected ability scores",
          )
        })

        it("creates a monster with the selected saving throws", async () => {
          const actor = await createTestActor({ type: "monster" })

          assert.instanceOf(actor.system, CONFIG.Actor.dataModels.monster)
          assert.deepEqual(
            Object.keys(actor.system.base.savingThrows).sort(),
            getSavingThrowKeys().sort(),
            "the monster schema doesn't match the selected saving throws",
          )
        })

        it("gives each actor type its own default artwork", async () => {
          const character = await createBlankCharacter()
          const monster = await createTestActor({ type: "monster" })

          assert.include(character.img, "actor.character")
          assert.include(monster.img, "actor.monster")
          assert.strictEqual(
            character.prototypeToken.texture.src,
            character.img,
            "the prototype token should use the same art as the actor",
          )
        })

        it("treats a scoreless character as needing scores rolled", async () => {
          const blank = await createBlankCharacter()
          assert.isTrue(blank.system.canRollAbilityScores)

          const rolled = await createTestCharacter()
          assert.isFalse(rolled.system.canRollAbilityScores)
        })

        it("persists ability scores and reports their modifiers", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 18, dex: 3 },
          })

          assert.strictEqual(actor.system.base.abilityScores.str, 18)
          assert.strictEqual(actor.system.abilityScores.str.value, 18)
          assert.strictEqual(actor.system.abilityScores.str.meleeAttack, 3)
          assert.strictEqual(actor.system.abilityScores.dex.value, 3)
        })

        it("groups an actor's owned items by type", async () => {
          const actor = await createTestCharacter()

          await createTestItem({ type: "weapon" }, actor)
          await createTestItem({ type: "armor" }, actor)
          await createTestItem({ type: "armor" }, actor)

          assert.lengthOf(actor.items.documentsByType.weapon, 1)
          assert.lengthOf(actor.items.documentsByType.armor, 2)
          assert.lengthOf(actor.items.documentsByType.spell, 0)
        })

        it("reports equipped items by type", async () => {
          const actor = await createTestCharacter()
          const weapon = await createTestItem({ type: "weapon" }, actor)
          await createTestItem({ type: "armor" }, actor)

          await weapon.equip()

          assert.lengthOf(actor.equipped.weapon, 1)
          assert.lengthOf(actor.equipped.armor, 0)
        })
      })

      describe("Character class documents", function classDocuments() {
        this.timeout(10000)

        after(() => cleanUpDocuments())

        it("builds an XP table row per level", async () => {
          const characterClass = await createTestClass({ levels: 3 })

          assert.lengthOf(characterClass.system.xpTable, 3)
          assert.strictEqual(characterClass.system.maxLevel, 3)
        })

        it("reports the details of the current level", async () => {
          const characterClass = await createTestClass({ levels: 3, level: 2 })
          const details = characterClass.system.currentLevelDetails

          assert.strictEqual(details.level, 2)
          // Row index 1 is level 2: THAC0 19 - 1, attack bonus 1.
          assert.strictEqual(details.thac0, 18)
          assert.strictEqual(details.attackBonus, 1)
          assert.strictEqual(details.hd.count, 2)
        })

        it("tracks progress towards the next level", async () => {
          const characterClass = await createTestClass({
            levels: 3,
            level: 1,
            xp: 400,
          })

          // Row index 1 (level 2) costs 1000 in the fixture's table.
          assert.strictEqual(characterClass.system.xpToNext, 1000)
          assert.strictEqual(characterClass.system.xpRemaining, 600)
          assert.isFalse(characterClass.system.canLevelUp)

          await characterClass.update({ "system.xp": 1000 })
          assert.strictEqual(characterClass.system.xpRemaining, 0)
          assert.isTrue(characterClass.system.canLevelUp)
        })

        it("stops offering levels past the end of the table", async () => {
          const characterClass = await createTestClass({
            levels: 2,
            level: 2,
            xp: 99999,
          })

          assert.isFalse(characterClass.system.canLevelUp)
          assert.isFalse(characterClass.system.canAddXP)
        })

        it("transposes spell slots into the current level's list", async () => {
          // [spellLevel][characterLevel]: 1 first level slot at level 1, 2 at
          // level 2; second level slots only start at level 2.
          const characterClass = await createTestClass({
            levels: 2,
            level: 2,
            spellSlots: [
              [1, 2],
              [0, 1],
            ],
          })

          assert.deepEqual(
            characterClass.system.currentLevelDetails.spellSlots,
            [2, 1],
          )
        })

        it("formats only the prerequisites that are actually set", async () => {
          const [firstScore] = getAbilityScoreKeys()
          const characterClass = await createTestClass({
            data: { system: { prerequisites: { [firstScore]: 9 } } },
          })

          assert.isTrue(characterClass.system.hasPrerequisites)
          assert.deepEqual(
            Object.keys(characterClass.system.prerequisitesFormatted),
            [firstScore],
          )
          assert.strictEqual(
            characterClass.system.prerequisitesFormatted[firstScore].value,
            9,
          )
        })
      })

      describe("Chat message data models", function chatDataModels() {
        this.timeout(10000)

        after(() => cleanUpDocuments())

        it("creates an action message with a structured outcome", async () => {
          const message = await ChatMessage.create({
            type: "action",
            system: {
              action: "test-action",
              outcome: [{ target: "untargeted", attempt: { success: true } }],
            },
          })

          assert.instanceOf(
            message.system,
            CONFIG.ChatMessage.dataModels.action,
          )
          assert.lengthOf(message.system.outcome, 1)
          assert.strictEqual(message.system.action, "test-action")

          await message.delete()
        })
      })
    },
    { displayName: "BAGS: Documents and data models" },
  )
}
