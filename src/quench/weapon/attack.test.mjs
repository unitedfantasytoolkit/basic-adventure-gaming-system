/**
 * @file Integration tests for a weapon's default attack.
 *
 * A weapon is an action-lite: it carries one action of its own in
 * `system.attack`, and `system.actionList` hands that back with a damage effect
 * assembled on the fly from the weapon's own fields -- the damage dice off the
 * stored effect, the damage bonus off the weapon, and the attack type deciding
 * which of the actor's bonuses apply. Nothing is stored in that assembled shape,
 * so it has to be built correctly every time it's read.
 *
 * Editing that attack through the weapon editor is `./edit.test.mjs`. Resolving
 * any action at all is `actions/resolution.test.mjs`; the one resolution test kept
 * here is the whole chain end to end, from a weapon nobody has configured to a
 * damage total.
 */

import {
  captureChatMessages,
  cleanUpDocuments,
  createTestCharacter,
  createTestItem,
  withFixedDice,
} from "../helpers.mjs"

/**
 * Register the weapon attacks test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerWeaponAttackTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.weapon.attack",
    (context) => {
      const { describe, it, assert, after } = context

      describe("The default attack", function defaultAttack() {
        this.timeout(10000)

        after(() => cleanUpDocuments())

        it("gives a new weapon a default attack action", async () => {
          const weapon = await createTestItem({ type: "weapon" })

          const [attack] = weapon.system.actionList

          assert.isOk(attack, "a new weapon should have an attack")
          assert.isTrue(attack.flags.usesAttempt)
          assert.isTrue(attack.flags.usesEffect)
          assert.isTrue(attack.attempt.flags.isLikeAttack)
        })

        it("folds the damage bonus into the default attack's formula", async () => {
          const weapon = await createTestItem({ type: "weapon" })

          await weapon.update({
            "system.attack.effects": [
              { ...weapon.system.attack.effects[0], formula: "1d8" },
            ],
            "system.damageBonus": 2,
          })

          const [attack] = weapon.system.actionList
          assert.strictEqual(attack.effects[0].formula, "1d8+2")

          await weapon.update({ "system.damageBonus": -1 })
          assert.strictEqual(
            weapon.system.actionList[0].effects[0].formula,
            "1d8-1",
          )
        })

        it("drops the default attack when it is turned off", async () => {
          const weapon = await createTestItem({ type: "weapon" })

          await weapon.update({ "system.usesDefaultAttack": false })

          assert.lengthOf(weapon.system.actionList, 0)
        })
      })

      describe("Resolving it", function resolving() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        /**
         * The single resolution from an untargeted action.
         * @param {Array} result - The resolver's result
         * @returns {object} The one and only outcome
         */
        const onlyOutcome = (result) => {
          assert.isArray(
            result,
            "the resolver should return an array of outcomes",
          )
          assert.lengthOf(result, 1)
          return result[0]
        }

        it("resolves a weapon's default attack through the item", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 18 },
          })
          const sword = await createTestItem(
            {
              type: "weapon",
              name: "Longsword",
              system: { damageBonus: 1 },
            },
            actor,
          )

          await sword.update({
            "system.attack.effects": [
              { ...sword.system.attack.effects[0], formula: "1d8" },
            ],
          })

          const [attack] = sword.system.actionList

          const { result, messages } = await withFixedDice("max", () =>
            captureChatMessages(() => sword.resolveAction(attack)),
          )

          const outcome = onlyOutcome(result)

          // 1d8 at maximum, +1 from the weapon, +3 from a strength of 18.
          assert.strictEqual(outcome.effects[0].value, 12)
          assert.lengthOf(messages, 1)
        })
      })
    },
    { displayName: "BAGS: Weapon attacks" },
  )
}
