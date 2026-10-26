/**
 * @file Integration tests for spells that run past the end of a round.
 *
 * In AD&D a seven-segment spell begun on segment 6 goes off on segment 3 of the
 * next round. Within its own round it sorts last; when the round closes, the
 * caster is carried into the next one on that segment, still declaring the
 * spell, whatever their side rolls.
 */

import {
  cleanUpDocuments,
  createTestActor,
  createTestCombat,
} from "../helpers.mjs"

/**
 * Register the spillover test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSpilloverTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.spillover",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A started 1st Edition fight: a mage whose side rolled 6, casting a
       * spell, against an orc on 4. Rolls are kept from round to round.
       * @param {object} [options] - Options.
       * @param {number} [options.castingTime] - The mage's spell, in segments.
       * @param {number} [options.distance] - How far the mage moves first.
       * @param {string} [options.preset] - The rules to run under.
       * @returns {Promise<object>} The combat and a name lookup.
       */
      const buildFight = async ({
        castingTime = 7,
        distance = 0,
        preset = "advanced-1e",
      } = {}) => {
        const combat = await createTestCombat({
          system: {
            initiativePreset: preset,
            rerollCadence: "keep",
            declarationMode: "optional",
          },
        })
        const actor = await createTestActor({ type: "monster" })
        const groups = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
          { name: "Orcs", system: { side: "hostile" } },
        ])
        const party = groups.find((group) => group.name === "Party")
        const orcs = groups.find((group) => group.name === "Orcs")
        await combat.createEmbeddedDocuments("Combatant", [
          {
            actorId: actor.id,
            group: party.id,
            name: "Mage",
            system: {
              declaration: {
                type: "bags.cast",
                values: { castingTime, distance },
              },
            },
          },
          {
            actorId: actor.id,
            group: orcs.id,
            name: "Orc",
            system: { declaration: { type: "bags.melee" } },
          },
        ])
        await party.update({ initiative: 6 })
        await orcs.update({ initiative: 4 })
        await combat.startCombat()

        const named = (name) => combat.combatants.find((c) => c.name === name)
        return { combat, named }
      }

      describe("Spells that run past the round", function spillover() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("says where a late spell really goes off", async () => {
          const { named } = await buildFight()
          const mage = named("Mage")

          assert.equal(mage.initiative, 10, "last in its own round")
          assert.deepEqual(mage.spillover, { round: 2, segment: 3 })
        })

        it("carries the caster into the next round on that segment", async () => {
          const { combat, named } = await buildFight()

          await combat.nextRound()

          const mage = named("Mage")
          assert.equal(combat.round, 2)
          assert.isTrue(mage.carried)
          assert.equal(mage.initiative, 3)
          assert.equal(combat.combatant?.name, "Mage", "and first to act")
          assert.equal(
            mage.system.declaration.type,
            "bags.cast",
            "still casting",
          )
          assert.notEqual(
            named("Orc").system.declaration.type,
            "bags.melee",
            "everyone else declares afresh",
          )
        })

        it("settles the caster's declaration while the spell is going", async () => {
          const { combat, named } = await buildFight()

          await combat.nextRound()

          assert.isTrue(named("Mage").declarationsLocked)
        })

        it("lets go once the spell has gone off", async () => {
          const { combat, named } = await buildFight()
          await combat.nextRound()

          await combat.nextRound()

          const mage = named("Mage")
          assert.equal(combat.round, 3)
          assert.isFalse(mage.carried)
          assert.equal(mage.initiative, 6, "back to the side's roll")
          assert.notEqual(mage.system.declaration.type, "bags.cast")
        })

        it("carries a long spell more than one round", async () => {
          // 6, plus 8 segments to cover 80 feet, plus 10 to cast: segment 24,
          // which is segment 4 of round three.
          const { combat, named } = await buildFight({
            castingTime: 10,
            distance: 80,
          })

          await combat.nextRound()
          assert.deepEqual(named("Mage").spillover, { round: 3, segment: 4 })

          await combat.nextRound()
          assert.equal(named("Mage").initiative, 4)
        })

        it("carries nothing in a game without segments", async () => {
          const { named } = await buildFight({ preset: "bx-group" })

          assert.isNull(named("Mage").spillover)
        })
      })
    },
    { displayName: "BAGS: Spillover" },
  )
}
