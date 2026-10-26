/**
 * @file Integration tests for morale: when a round waits for checks, who rolls
 * them, and what happens to the monsters who break.
 */

import { MORALE_FAILURE_STATUS } from "../../combat/morale.mjs"
import {
  captureChatMessages,
  cleanUpDocuments,
  createTestActor,
  createTestCombat,
  withFixedDice,
} from "../helpers.mjs"

/**
 * Register the morale test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerMoraleTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.morale",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A started fight: a player's hero against four orcs, each orc its own
       * monster so that a status on one is not a status on all of them.
       * Initiative is kept from round to round and nobody declares, so a round
       * begins as soon as it opens unless morale holds it up.
       * @param {object} [options] - Options.
       * @param {boolean} [options.leader] - Make the first orc one whose death
       * shakes the rest.
       * @returns {Promise<object>} The combat and a name lookup.
       */
      const buildFight = async ({ leader = false } = {}) => {
        const player = game.users.find((user) => !user.isGM)
        const hero = await createTestActor({
          type: "monster",
          name: "Hero",
          ownership: player ? { [player.id]: 3 } : {},
        })
        const orcs = await Promise.all(
          [1, 2, 3, 4].map((n) =>
            createTestActor({
              type: "monster",
              name: `Orc ${n}`,
              system: {
                morale: {
                  value: 7,
                  isWorthPanickingOverDying: leader && n === 1,
                },
              },
            }),
          ),
        )

        const combat = await createTestCombat({
          system: { rerollCadence: "keep", declarationMode: "off" },
        })
        const groups = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
          { name: "Orcs", system: { side: "hostile" } },
        ])
        const party = groups.find((group) => group.name === "Party")
        const orcGroup = groups.find((group) => group.name === "Orcs")
        await combat.createEmbeddedDocuments("Combatant", [
          { actorId: hero.id, group: party.id, name: "Hero" },
          ...orcs.map((actor) => ({
            actorId: actor.id,
            group: orcGroup.id,
            name: actor.name,
          })),
        ])
        await party.update({ initiative: 5 })
        await orcGroup.update({ initiative: 3 })
        await combat.startCombat()

        const named = (name) => combat.combatants.find((c) => c.name === name)
        return { combat, named }
      }

      /**
       * Defeat some orcs and close the round.
       * @param {Combat} combat - The encounter.
       * @param {Function} named - Looks a combatant up by name.
       * @param {string[]} names - Who falls.
       * @returns {Promise<void>}
       */
      const felled = async (combat, named, names) => {
        await Promise.all(
          names.map((name) => named(name).update({ defeated: true })),
        )
        await combat.nextRound()
      }

      describe("Owing a check", function owing() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("holds the round when half a group is down", async () => {
          const { combat, named } = await buildFight()

          await felled(combat, named, ["Orc 1", "Orc 2"])

          assert.isTrue(combat.betweenRounds, "the round waits")
          assert.lengthOf(combat.pendingMorale, 1)
          assert.equal(combat.pendingMorale[0].trigger, "half")
        })

        it("does not hold it for less than half", async () => {
          const { combat, named } = await buildFight()

          await felled(combat, named, ["Orc 1"])

          assert.isFalse(combat.betweenRounds)
          assert.isEmpty(combat.pendingMorale)
        })

        it("holds it when an important monster falls", async () => {
          const { combat, named } = await buildFight({ leader: true })

          await felled(combat, named, ["Orc 1"])

          assert.isTrue(combat.betweenRounds)
          assert.equal(combat.pendingMorale[0].trigger, "death")
        })

        it("asks only once for each reason", async () => {
          const { combat, named } = await buildFight()
          await felled(combat, named, ["Orc 1", "Orc 2"])
          await combat.skipPendingMorale()
          assert.isFalse(combat.betweenRounds, "skipping begins the round")

          await combat.nextRound()

          assert.isFalse(combat.betweenRounds, "nothing new to check")
        })

        it("drops the checks when the round is begun anyway", async () => {
          const { combat, named } = await buildFight()
          await felled(combat, named, ["Orc 1", "Orc 2"])

          await combat.beginRound()

          assert.isEmpty(combat.pendingMorale)
        })
      })

      describe("Rolling the check", function rolling() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("marks the standing monsters who roll over", async () => {
          const { combat, named } = await buildFight()
          await felled(combat, named, ["Orc 1", "Orc 2"])

          const { result, messages } = await captureChatMessages(() =>
            withFixedDice("max", () => combat.resolvePendingMorale()),
          )

          assert.sameMembers(
            result.map((r) => r.combatant.name),
            ["Orc 3", "Orc 4"],
            "only the orcs still standing",
          )
          assert.isTrue(result.every((r) => r.failed))
          assert.isTrue(
            named("Orc 3").actor.statuses.has(MORALE_FAILURE_STATUS),
          )
          assert.isFalse(combat.betweenRounds, "and the round begins")
          assert.lengthOf(messages, 1)
          assert.isNotEmpty(messages[0].whisper, "for the referee only")
        })

        it("leaves the monsters who hold alone", async () => {
          const { combat, named } = await buildFight()
          await felled(combat, named, ["Orc 1", "Orc 2"])

          const { result } = await captureChatMessages(() =>
            withFixedDice("min", () => combat.resolvePendingMorale()),
          )

          assert.isTrue(result.every((r) => !r.failed))
          assert.isFalse(
            named("Orc 3").actor.statuses.has(MORALE_FAILURE_STATUS),
          )
        })

        it("never rolls for a player's character", async () => {
          const { combat, named } = await buildFight()
          assert.isTrue(named("Hero").hasPlayerOwner, "fixture sanity")

          const results = await combat.rollMorale([named("Hero")])

          assert.isEmpty(results)
        })

        it("does not roll again for a monster already broken", async () => {
          const { combat, named } = await buildFight()
          await captureChatMessages(() =>
            withFixedDice("max", () => combat.rollMorale([named("Orc 3")])),
          )

          const { result } = await captureChatMessages(() =>
            combat.rollMorale([named("Orc 3")]),
          )

          assert.isEmpty(result)
        })
      })
    },
    { displayName: "BAGS: Morale" },
  )
}
