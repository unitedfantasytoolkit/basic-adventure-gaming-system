/**
 * @file Integration tests for how a round opens, waits and begins.
 *
 * A round can sit "between rounds" -- announced, but with nobody's turn yet --
 * while players declare and the dice come out. These tests check the edges of
 * that window: what is cleared when a round closes, what makes it begin, and
 * that Foundry's turn events fire when it does rather than when it opened.
 */

import {
  cleanUpDocuments,
  createTestActor,
  createTestCombat,
  settle,
  waitFor,
} from "../helpers.mjs"
import { captureRound } from "../../combat/round-card.mjs"

/**
 * Register the round lifecycle test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerRoundLifecycleTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.round-lifecycle",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A user who is not a GM, if the world has one. A round only waits on
       * declarations from player characters, so some tests need one.
       * @returns {User|undefined} A player.
       */
      const findPlayer = () => game.users.find((user) => !user.isGM)

      /**
       * An encounter between a party and a band of orcs.
       * @param {object} [options] - Options.
       * @param {object} [options.system] - Per-encounter rule overrides.
       * @param {User} [options.player] - Gives the party's hero to this user,
       *   which makes the round wait for them to declare.
       * @returns {Promise<object>} The combat, both groups, and a name lookup.
       */
      const buildFight = async ({ system = {}, player } = {}) => {
        const combat = await createTestCombat({
          system: { declarationMode: "optional", ...system },
        })
        const ownership = player
          ? { [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
          : {}
        const hero = await createTestActor({ type: "monster", ownership })
        const orc = await createTestActor({ type: "monster" })
        const [party, orcs] = await combat.createEmbeddedDocuments(
          "CombatantGroup",
          [
            { name: "Party", system: { side: "party" } },
            { name: "Orcs", system: { side: "hostile" } },
          ],
        )
        await combat.createEmbeddedDocuments("Combatant", [
          { actorId: hero.id, group: party.id, name: "Hero" },
          { actorId: orc.id, group: orcs.id, name: "Orc 1" },
          { actorId: orc.id, group: orcs.id, name: "Orc 2" },
        ])

        const named = (name) => combat.combatants.find((c) => c.name === name)
        return { combat, party, orcs, named }
      }

      describe("Opening and beginning a round", function lifecycle() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("keeps declarations made before the fight", async () => {
          // They were made for round one. Starting used to wipe them, which
          // left the table that declared first with nothing it had said.
          const { combat, named } = await buildFight()
          await named("Hero").update({
            system: { declaration: { type: "bags.melee" } },
          })

          await combat.startCombat()

          assert.equal(named("Hero").system.declaration.type, "bags.melee")
          assert.isFalse(combat.betweenRounds, "nothing should be waited on")
        })

        it("waits between rounds for a player to declare", async () => {
          const player = findPlayer()
          if (!player) {
            assert.ok(true, "no player in this world")
            return
          }

          const { combat, named } = await buildFight({ player })
          await named("Hero").update({
            system: { declaration: { type: "bags.melee" } },
          })
          await combat.startCombat()
          assert.isFalse(combat.betweenRounds, "round one had its declaration")

          await combat.nextRound()

          assert.isTrue(combat.betweenRounds)
          assert.equal(combat.round, 2)
          assert.equal(named("Hero").system.declaration.type, "")
          assert.isTrue(
            combat.rollingUnits.every((unit) => unit.initiative === null),
            "the dice wait for the declarations",
          )
        })

        it("begins by itself once the last player declares", async () => {
          const player = findPlayer()
          if (!player) {
            assert.ok(true, "no player in this world")
            return
          }

          const { combat, named } = await buildFight({ player })
          await combat.startCombat()
          assert.isTrue(combat.betweenRounds)

          await named("Hero").update({
            system: { declaration: { type: "bags.melee" } },
          })

          await waitFor(() => !combat.betweenRounds, "the round to begin")
          assert.equal(combat.turn, 0)
          assert.isTrue(
            combat.rollingUnits.every((unit) => unit.initiative !== null),
            "beginning should roll for everyone",
          )
        })

        it("lets the referee begin without waiting", async () => {
          const player = findPlayer()
          if (!player) {
            assert.ok(true, "no player in this world")
            return
          }

          const { combat } = await buildFight({ player })
          await combat.startCombat()
          assert.isTrue(combat.betweenRounds)

          await combat.nextTurn()

          assert.isFalse(combat.betweenRounds)
          assert.equal(combat.round, 1, "Next Turn begins, it does not skip")
        })

        it("fires the round's turn events when it begins", async () => {
          // Rolling by hand keeps the round waiting with no player involved.
          const { combat, party, orcs } = await buildFight({
            system: { rerollCadence: "reset" },
          })
          const started = { rounds: [], turns: [] }
          const { _onStartRound, _onStartTurn } = combat
          combat._onStartRound = function spyRound(event) {
            started.rounds.push(event.round)
            return _onStartRound.call(this, event)
          }
          combat._onStartTurn = function spyTurn(combatant, event) {
            started.turns.push(combatant.id)
            return _onStartTurn.call(this, combatant, event)
          }

          await combat.startCombat()
          assert.isTrue(combat.betweenRounds)
          await party.update({ initiative: 2 })
          assert.isTrue(combat.betweenRounds, "the orcs have not rolled")
          assert.isEmpty(started.turns, "nobody's turn starts while waiting")

          await orcs.update({ initiative: 5 })
          await waitFor(
            () => started.turns.length > 0,
            "the first turn to start",
          )

          assert.deepEqual(started.rounds, [1])
          assert.equal(
            started.turns[0],
            combat.turns[0].id,
            "the first turn belongs to whoever the dice put first",
          )
          assert.equal(combat.turns[0].name.slice(0, 3), "Orc")
        })
      })

      describe("Changes during a round", function during() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("keeps the cursor on the acting combatant when a side rerolls", async () => {
          const { combat, party, orcs, named } = await buildFight({
            system: { rerollCadence: "keep" },
          })
          // Rolled before the start, so the round begins with the party up.
          await party.update({ initiative: 5 })
          await orcs.update({ initiative: 3 })
          await combat.startCombat()
          assert.equal(combat.combatant?.id, named("Hero").id)

          await combat.nextTurn()
          const acting = combat.combatant
          assert.equal(acting.name.slice(0, 3), "Orc")

          await orcs.update({ initiative: 6 })

          await waitFor(
            () => combat.turns[0].name.slice(0, 3) === "Orc",
            "the orcs to move to the front",
          )
          assert.equal(combat.combatant.id, acting.id)
          assert.equal(combat._source.turn, combat.turn)
        })

        it("adjusts a lone roller's own roll, not its derived score", async () => {
          // AD&D 2e: everyone rolls alone, and a declaration offsets the score.
          const combat = await createTestCombat({
            system: { initiativePreset: "advanced-2e" },
          })
          const actor = await createTestActor({ type: "monster" })
          const [caster] = await combat.createEmbeddedDocuments("Combatant", [
            {
              actorId: actor.id,
              name: "Caster",
              system: {
                declaration: { type: "bags.cast", values: { castingTime: 3 } },
              },
            },
          ])
          await caster.update({ initiative: 4 })
          const offset = caster.initiative - 4
          assert.notEqual(offset, 0, "fixture should give the caster an offset")

          await combat.adjustInitiative(caster.id, 1)

          assert.equal(caster._source.initiative, 5)
          assert.equal(caster.initiative, 5 + offset)
        })

        it("leaves hidden combatants off the round's card", async () => {
          const { combat, named } = await buildFight()
          await named("Orc 2").update({ hidden: true })
          await combat.startCombat()

          const names = JSON.stringify(captureRound(combat))

          assert.include(names, "Orc 1")
          assert.notInclude(names, "Orc 2")
        })

        it("reopens declarations each round under the keep cadence", async () => {
          // Keeping last round's dice used to lock declarations for the rest of
          // the fight, since the lock was keyed on a roll being present.
          const player = findPlayer()
          if (!player) {
            assert.ok(true, "no player in this world")
            return
          }

          const { combat, named } = await buildFight({
            player,
            system: { initiativePreset: "advanced-1e", rerollCadence: "keep" },
          })
          const hero = named("Hero")
          await combat.startCombat()
          await hero.update({ system: { declaration: { type: "bags.melee" } } })
          await waitFor(() => hero.declarationsLocked, "round one to begin")

          await combat.nextRound()

          assert.isTrue(combat.betweenRounds)
          assert.isFalse(hero.declarationsLocked)
        })
      })

      describe("Stepping back, and leaving a group", function regrouping() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("puts back the declarations and rolls of the round stepped into", async () => {
          // The mistaken Next Round. Closing the round cleared what everyone
          // said and rerolled; stepping back should undo both.
          const { combat, party, orcs, named } = await buildFight({
            system: { rerollCadence: "reroll" },
          })
          await party.update({ initiative: 5 })
          await orcs.update({ initiative: 3 })
          await named("Hero").update({
            system: { declaration: { type: "bags.melee" } },
          })
          await combat.startCombat()
          await combat.nextRound()
          assert.equal(named("Hero").system.declaration.type, "")

          await combat.previousRound()

          assert.equal(combat.round, 1)
          assert.equal(named("Hero").system.declaration.type, "bags.melee")
          assert.equal(party.initiative, 5)
          assert.equal(orcs.initiative, 3)
          assert.equal(combat.turn, combat.turns.length - 1)
          assert.equal(combat.combatant.name.slice(0, 3), "Orc")
        })

        it("steps back out of a waiting round without beginning it", async () => {
          const { combat, party, orcs } = await buildFight({
            system: { rerollCadence: "reset" },
          })
          await party.update({ initiative: 5 })
          await orcs.update({ initiative: 3 })
          await combat.startCombat()
          await combat.nextRound()
          assert.isTrue(combat.betweenRounds, "round two waits for the dice")

          await combat.previousRound()
          // Long enough for an automatic begin to have happened, if one would.
          await settle()

          assert.equal(combat.round, 1)
          assert.isFalse(combat.betweenRounds)
          assert.equal(party.initiative, 5)
          assert.equal(orcs.initiative, 3)
        })

        it("rolls only the monsters that have not rolled", async () => {
          const { combat, party, orcs } = await buildFight()
          await orcs.update({ initiative: 3 })

          await combat.rollNPC()

          assert.equal(orcs.initiative, 3, "a roll already made is kept")
          assert.isNotNull(party.initiative, "nobody here has a player owner")
        })

        it("hands a combatant its group's roll as it leaves", async () => {
          // A grouped combatant's own stored roll is never read, so it can be
          // anything -- here, a leftover from before they joined.
          const { orcs, named } = await buildFight()
          const orc = named("Orc 1")
          await orc.update({ initiative: 17 })
          await orcs.update({ initiative: 3 })

          await orc.update({ group: null })

          assert.equal(orc.initiative, 3)
        })

        it("does the same when the group is deleted", async () => {
          const { orcs, named } = await buildFight()
          await named("Orc 2").update({ initiative: 17 })
          await orcs.update({ initiative: 3 })

          await orcs.delete()

          assert.equal(named("Orc 2").initiative, 3)
        })
      })
    },
    { displayName: "BAGS: Round Lifecycle" },
  )
}
