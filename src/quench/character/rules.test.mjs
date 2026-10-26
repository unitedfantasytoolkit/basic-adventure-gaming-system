/**
 * @file Integration tests for a character's derived statistics.
 *
 * Armor Class, attack bonuses, saving throws and spell slots are all getters
 * that read three things at once: the character's own fields, their owned Items,
 * and whichever rules module the world has selected. That combination is exactly
 * what unit tests can't reach, and it's also where the interesting bugs live --
 * an ascending-AC world getting descending-AC maths, a shield counting as body
 * armour, a save bonus applied twice.
 *
 * Where a test cares about ascending versus descending Armor Class it swaps the
 * combat rules module for the duration, because both are supported and the
 * arithmetic runs in opposite directions.
 */

import {
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
  getSavingThrowKeys,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the derived character data test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerCharacterRulesTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.rules",
    (context) => {
      const { describe, it, assert, after } = context

      const registry = () => CONFIG.BAGS.SystemRegistry
      const combatCategory = () => registry().categories.COMBAT

      /**
       * Run a callback with descending Armor Class selected (B/X's default).
       * @template T
       * @param {() => Promise<T>|T} callback - The work to do
       * @returns {Promise<T>} Whatever the callback returned
       */
      const withDescendingAC = (callback) =>
        withRulesModule(combatCategory(), "bx-descending", callback)

      /**
       * Run a callback with ascending Armor Class selected.
       * @template T
       * @param {() => Promise<T>|T} callback - The work to do
       * @returns {Promise<T>} Whatever the callback returned
       */
      const withAscendingAC = (callback) =>
        withRulesModule(combatCategory(), "bx-ascending", callback)

      describe("Armor Class", function armorClass() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("falls back to the rules module's base AC", async () => {
          const actor = await createTestCharacter()

          await withDescendingAC(() => {
            assert.strictEqual(actor.system.armorClass, 10)
          })

          await withAscendingAC(() => {
            assert.strictEqual(actor.system.armorClass, 9)
          })
        })

        it("uses worn armor instead of the base AC", async () => {
          const actor = await createTestCharacter()
          // Chain mail: three points better than unarmoured.
          const armor = await createTestItem(
            {
              type: "armor",
              system: { armorBonus: 3, isEquipped: true },
            },
            actor,
          )

          await withDescendingAC(() => {
            // Descending AC counts down: 10 - 3.
            assert.strictEqual(armor.system.armorClass, 7)
            assert.strictEqual(actor.system.armorClass, 7)
          })

          await withAscendingAC(() => {
            // Ascending AC counts up from a base of 9.
            assert.strictEqual(armor.system.armorClass, 12)
            assert.strictEqual(actor.system.armorClass, 12)
          })
        })

        it("ignores armor that isn't equipped", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            { type: "armor", system: { armorBonus: 3, isEquipped: false } },
            actor,
          )

          await withDescendingAC(() => {
            assert.strictEqual(actor.system.armorClass, 10)
          })
        })

        it("stacks a shield on top of worn armor", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            { type: "armor", system: { armorBonus: 3, isEquipped: true } },
            actor,
          )
          await createTestItem(
            {
              type: "armor",
              system: {
                armorBonus: 1,
                shouldTreatAsBonus: true,
                isEquipped: true,
              },
            },
            actor,
          )

          await withDescendingAC(() => {
            // 10 - 3 for the armor, then one more for the shield.
            assert.strictEqual(actor.system.armorClass, 6)
          })

          await withAscendingAC(() => {
            // The same two items, counted the other way: a shield has to make
            // its wearer harder to hit whichever direction AC runs in.
            assert.strictEqual(actor.system.armorClass, 13)
          })
        })

        it("applies the dexterity bonus", async () => {
          const actor = await createTestCharacter({
            abilityScores: { dex: 18 },
          })

          const dexBonus = actor.system.abilityScores.dex.ac
          assert.isNumber(dexBonus, "a high dex should give an AC bonus")
          assert.notStrictEqual(dexBonus, 0)

          await withDescendingAC(() => {
            assert.strictEqual(actor.system.armorClass, 10 - dexBonus)
          })

          await withAscendingAC(() => {
            assert.strictEqual(actor.system.armorClass, 9 + dexBonus)
          })
        })

        it("penalises a low dexterity", async () => {
          const low = await createTestCharacter({ abilityScores: { dex: 3 } })
          const average = await createTestCharacter()

          await withDescendingAC(() => {
            // Worse AC is a higher number when AC descends.
            assert.isAbove(low.system.armorClass, average.system.armorClass)
          })
        })
      })

      describe("Attack and damage bonuses", function attackBonuses() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("uses the worst possible THAC0 without a class", async () => {
          const actor = await createTestCharacter()

          assert.strictEqual(actor.system.thac0, 19)
        })

        it("takes THAC0 and attack bonus from the class's current level", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 3, level: 3, actor })

          // Row index 2 in the fixture's table: THAC0 19 - 2, attack bonus 2.
          assert.strictEqual(actor.system.thac0, 17)

          await withAscendingAC(() => {
            assert.strictEqual(actor.system.baseAttackBonus, 2)
          })
        })

        it("keeps the attack bonus at zero under descending AC", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 3, level: 3, actor })

          await withDescendingAC(() => {
            // Descending AC expresses progression through THAC0 instead, so
            // adding an attack bonus as well would count it twice.
            assert.strictEqual(actor.system.baseAttackBonus, 0)
          })
        })

        it("adds strength to melee attacks and damage", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 18 },
          })

          // B/X gives a strength of 18 +3 to hit and to damage in melee.
          assert.strictEqual(actor.system.meleeAttackBonus, 3)
          assert.strictEqual(actor.system.meleeDamageBonus, 3)
        })

        it("adds dexterity to missile attacks and damage", async () => {
          const actor = await createTestCharacter({
            abilityScores: { dex: 18 },
          })

          assert.strictEqual(actor.system.missileAttackBonus, 3)
          assert.strictEqual(
            actor.system.missileDamageBonus,
            actor.system.abilityScores.dex.missileDamage,
          )
        })

        it("adds the character's own modifiers on top", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 18 },
          })

          await actor.update({
            "system.modifiers.melee.attack": 2,
            "system.modifiers.melee.damage": 1,
          })

          assert.strictEqual(actor.system.meleeAttackBonus, 5)
          assert.strictEqual(actor.system.meleeDamageBonus, 4)
        })

        it("treats an average score as no bonus at all", async () => {
          const actor = await createTestCharacter()

          assert.strictEqual(actor.system.meleeAttackBonus, 0)
          assert.strictEqual(actor.system.meleeDamageBonus, 0)
          assert.strictEqual(actor.system.missileAttackBonus, 0)
        })
      })

      describe("Saving throws", function savingThrows() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("uses the worst possible save without a class", async () => {
          const actor = await createTestCharacter()
          const worst = registry().getSelectedOfCategory(
            registry().categories.SAVING_THROWS,
          ).worstPossible

          const saves = actor.system.savingThrows

          assert.deepEqual(
            Object.keys(saves).sort(),
            getSavingThrowKeys().sort(),
          )
          Object.entries(saves).forEach(([key, value]) => {
            assert.strictEqual(value, worst, `${key} should be the worst save`)
          })
        })

        it("takes saves from the class's current level", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 3, level: 3, actor })

          // The fixture improves every save by one per level: 14 - 2 at level 3.
          Object.values(actor.system.savingThrows).forEach((value) => {
            assert.strictEqual(value, 12)
          })
        })

        it("adds the character's saving throw modifiers", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 3, level: 1, actor })

          const [firstSave] = getSavingThrowKeys()
          await actor.update({
            [`system.modifiers.savingThrows.${firstSave}`]: -2,
          })

          assert.strictEqual(actor.system.savingThrows[firstSave], 12)
          // Every other save is untouched.
          getSavingThrowKeys()
            .filter((key) => key !== firstSave)
            .forEach((key) => {
              assert.strictEqual(actor.system.savingThrows[key], 14)
            })
        })
      })

      describe("Class and level", function classAndLevel() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("reports no class for a classless character", async () => {
          const actor = await createTestCharacter()

          assert.isNull(actor.system.class)
        })

        it("surfaces the class's current level details", async () => {
          const actor = await createTestCharacter()
          const characterClass = await createTestClass({
            levels: 3,
            level: 2,
            actor,
          })

          assert.strictEqual(actor.system.class.level, 2)
          assert.strictEqual(actor.system.class.name, characterClass.name)
          assert.strictEqual(actor.system.class.id, characterClass.id)
        })

        it("tracks experience towards the next level", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 3, level: 1, xp: 250, actor })

          assert.strictEqual(actor.system.class.xp.current, 250)
          assert.strictEqual(actor.system.class.xp.next, 1000)
        })
      })

      describe("Spell slots", function spellSlots() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("reports no usable slots without a spellcasting class", async () => {
          const actor = await createTestCharacter()

          assert.isTrue(
            actor.system.spellSlots.every((slots) => !slots),
            "a classless character should have no slots",
          )
        })

        it("takes slots from the class's current level", async () => {
          const actor = await createTestCharacter()
          await createTestClass({
            levels: 2,
            level: 2,
            actor,
            spellSlots: [
              [1, 2],
              [0, 1],
            ],
          })

          assert.strictEqual(actor.system.spellSlots[0], 2)
          assert.strictEqual(actor.system.spellSlots[1], 1)
        })

        it("adds the character's spell slot modifiers", async () => {
          const actor = await createTestCharacter()
          await createTestClass({
            levels: 1,
            level: 1,
            actor,
            spellSlots: [[1]],
          })

          const modifiers = [...actor.system.modifiers.spellSlots]
          modifiers[0] = 1
          await actor.update({ "system.modifiers.spellSlots": modifiers })

          assert.strictEqual(actor.system.spellSlots[0], 2)
        })
      })

      describe("Active Effects from items", function itemEffects() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("only applies an effect from equipped gear", async () => {
          const actor = await createTestCharacter()
          const ring = await createTestItem(
            {
              type: "item",
              name: "Ring of Protection",
              system: { isEquipped: false },
              effects: [
                {
                  name: "Protection",
                  transfer: true,
                  system: {
                    changes: [
                      {
                        key: "system.base.armorClassOffset",
                        value: "1",
                        type: "add",
                      },
                    ],
                  },
                },
              ],
            },
            actor,
          )

          const applied = () =>
            Array.from(actor.allApplicableEffects()).map(
              (effect) => effect.name,
            )

          assert.notInclude(
            applied(),
            "Protection",
            "an unequipped item should not apply its effects",
          )

          await ring.equip()

          assert.include(
            applied(),
            "Protection",
            "an equipped item should apply its effects",
          )
        })

        it("groups applied effects by the key they change", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "armor",
              name: "Blessed Plate",
              system: { isEquipped: true },
              effects: [
                {
                  name: "Blessing",
                  transfer: true,
                  system: {
                    changes: [
                      {
                        key: "system.modifiers.melee.attack",
                        value: "1",
                        type: "add",
                      },
                    ],
                  },
                },
              ],
            },
            actor,
          )

          const byKey = actor.appliedEffectsByAffectedKey

          assert.isTrue(
            byKey.has("system.modifiers.melee.attack"),
            "the changed key should be indexed",
          )
          assert.strictEqual(
            byKey.get("system.modifiers.melee.attack")[0].name,
            "Blessing",
          )
        })
      })
    },
    { displayName: "BAGS: Character rules" },
  )
}
