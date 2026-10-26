/**
 * @file Integration tests for surprise: rolling it, marking it by hand, and
 * what it costs in each family of rules.
 *
 * In the Basic/Expert family and 2nd Edition a surprised side loses the first
 * round, so the cursor has to pass over it. In 1st Edition it loses segments
 * instead, so it has to move down the order. Both are checked here, along with
 * surprise ending when the first round does.
 */

import { SYSTEM_NAME } from "../../config/constants.mjs"
import { SURPRISE_FLAG, storedSurprise } from "../../combat/surprise.mjs"
import {
  captureChatMessages,
  cleanUpDocuments,
  createTestActor,
  createTestCombat,
} from "../helpers.mjs"

/**
 * Run a callback with dice that roll a fixed sequence of results.
 *
 * `withFixedDice` sets every die to one face, which makes every side roll the
 * same -- and a fight where everyone is surprised is one where nobody is. This
 * gives the first die one result and every later die another.
 * @param {number[]} uniforms - Values for `CONFIG.Dice.randomUniform` to return,
 * in order. Near 1 rolls a 1; 0 rolls the die's highest face.
 * @param {Function} callback - The work to do.
 * @returns {Promise<any>} Whatever the callback returns.
 */
const withDiceSequence = async (uniforms, callback) => {
  const original = CONFIG.Dice.randomUniform
  const queue = [...uniforms]
  CONFIG.Dice.randomUniform = () =>
    queue.length > 1 ? queue.shift() : queue[0]
  try {
    return await callback()
  } finally {
    CONFIG.Dice.randomUniform = original
  }
}

/**
 * Register the surprise test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSurpriseTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.surprise",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A fight that has not started: a hero, then two orcs. Rolls are kept
       * from round to round, so a new round does not reshuffle the order.
       * @param {object} [system] - Per-encounter rule overrides.
       * @param {object} [rolls] - The party's and the orcs' initiative.
       * @returns {Promise<object>} The combat and a name lookup.
       */
      const buildFight = async (system = {}, { party = 5, orcs = 3 } = {}) => {
        const combat = await createTestCombat({
          system: { rerollCadence: "keep", declarationMode: "off", ...system },
        })
        const actor = await createTestActor({ type: "monster" })
        const groups = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
          { name: "Orcs", system: { side: "hostile" } },
        ])
        const partyGroup = groups.find((group) => group.name === "Party")
        const orcGroup = groups.find((group) => group.name === "Orcs")
        await combat.createEmbeddedDocuments("Combatant", [
          { actorId: actor.id, group: partyGroup.id, name: "Hero" },
          { actorId: actor.id, group: orcGroup.id, name: "Orc 1" },
          { actorId: actor.id, group: orcGroup.id, name: "Orc 2" },
        ])
        await partyGroup.update({ initiative: party })
        await orcGroup.update({ initiative: orcs })

        const named = (name) => combat.combatants.find((c) => c.name === name)
        return { combat, named }
      }

      /**
       * Mark the two orcs surprised.
       * @param {Combat} combat - The encounter.
       * @param {Function} named - Looks a combatant up by name.
       * @returns {Promise<void>}
       */
      const surpriseOrcs = async (combat, named) => {
        await combat.setSurprised(named("Orc 1"), true)
        await combat.setSurprised(named("Orc 2"), true)
      }

      describe("Losing the first round", function lostRound() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("passes over a surprised side in the first round", async () => {
          const { combat, named } = await buildFight()
          await surpriseOrcs(combat, named)
          await combat.startCombat()
          assert.equal(combat.combatant.name, "Hero")

          await combat.nextTurn()

          assert.equal(combat.round, 2, "straight on to round two")
          assert.equal(combat.combatant.name, "Hero")
        })

        it("gives the surprised side its turn in round two", async () => {
          const { combat, named } = await buildFight()
          await surpriseOrcs(combat, named)
          await combat.startCombat()
          await combat.nextTurn()

          await combat.nextTurn()

          assert.equal(combat.round, 2)
          assert.equal(combat.combatant.rollingGroup?.name, "Orcs")
          assert.isNull(storedSurprise(combat), "surprise ended with round one")
        })

        it("begins with the first side that can act", async () => {
          // The orcs won initiative, but they were surprised.
          const { combat, named } = await buildFight({}, { party: 2, orcs: 6 })
          await surpriseOrcs(combat, named)

          await combat.startCombat()

          assert.equal(combat.combatant.name, "Hero")
        })

        it("passes over them one combatant at a time too", async () => {
          const { combat, named } = await buildFight({
            turnGranularity: "combatant",
          })
          await surpriseOrcs(combat, named)
          await combat.startCombat()

          await combat.nextTurn()

          assert.equal(combat.round, 2)
          assert.equal(combat.combatant.name, "Hero")
        })

        it("cannot be changed once the first round is under way", async () => {
          const { combat, named } = await buildFight()
          await combat.startCombat()
          assert.isFalse(combat.canChangeSurprise)

          await combat.setSurprised(named("Orc 1"), true)

          assert.isNull(named("Orc 1").surprise)
        })

        it("comes back when stepping back into round one", async () => {
          const { combat, named } = await buildFight()
          await surpriseOrcs(combat, named)
          await combat.startCombat()
          await combat.nextTurn()
          assert.equal(combat.round, 2)

          await combat.previousRound()

          assert.equal(combat.round, 1)
          assert.isNotNull(named("Orc 1").surprise)
        })
      })

      describe("Losing segments", function lostSegments() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("pushes a surprised combatant back by what they lost", async () => {
          const { combat, named } = await buildFight(
            { initiativePreset: "advanced-1e" },
            { party: 2, orcs: 3 },
          )
          await combat.update({
            [`flags.${SYSTEM_NAME}.${SURPRISE_FLAG}`]: {
              sides: [],
              combatants: [{ _id: named("Orc 1").id, segments: 4 }],
            },
          })

          assert.equal(named("Orc 1").initiative, 7, "3 plus 4 lost")
          assert.equal(named("Orc 2").initiative, 3, "not surprised")
          assert.equal(combat.turns.at(-1).name, "Orc 1", "moved to the end")
        })

        it("lets the surprised side act in round one", async () => {
          const { combat, named } = await buildFight(
            { initiativePreset: "advanced-1e" },
            { party: 2, orcs: 3 },
          )
          await combat.update({
            [`flags.${SYSTEM_NAME}.${SURPRISE_FLAG}`]: {
              sides: [],
              combatants: [{ _id: named("Orc 1").id, segments: 4 }],
            },
          })
          await combat.startCombat()

          await combat.nextTurn()
          await combat.nextTurn()

          assert.equal(combat.round, 1)
          assert.equal(combat.combatant.name, "Orc 1")
        })

        it("stops pushing them back in round two", async () => {
          const { combat, named } = await buildFight(
            { initiativePreset: "advanced-1e" },
            { party: 2, orcs: 3 },
          )
          await combat.update({
            [`flags.${SYSTEM_NAME}.${SURPRISE_FLAG}`]: {
              sides: [],
              combatants: [{ _id: named("Orc 1").id, segments: 4 }],
            },
          })
          await combat.startCombat()

          await combat.nextRound()

          assert.equal(combat.round, 2)
          assert.equal(named("Orc 1").initiative, 3)
        })
      })

      describe("Rolling surprise", function rolling() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("marks everyone on a side that rolled low", async () => {
          const { combat } = await buildFight()

          const { result, messages } = await captureChatMessages(() =>
            withDiceSequence([0.999999, 0], () => combat.rollSurprise()),
          )

          assert.lengthOf(result, 2, "one roll per side")
          const caught = result.filter((side) => side.surprised)
          assert.lengthOf(caught, 1, "a 1 against a 6")

          const marked = combat.combatants.filter((c) => c.surprise)
          assert.isNotEmpty(marked)
          assert.isTrue(marked.every((c) => c.side === caught[0].side))
          assert.lengthOf(messages, 1, "one card for the roll")
        })

        it("surprises nobody when everyone rolled low", async () => {
          const { combat } = await buildFight()

          const { result } = await captureChatMessages(() =>
            withDiceSequence([0.999999], () => combat.rollSurprise()),
          )

          assert.isTrue(result.every((side) => !side.surprised))
          assert.isTrue(combat.combatants.every((c) => !c.surprise))
        })

        it("can be cleared before the fight", async () => {
          const { combat, named } = await buildFight()
          await surpriseOrcs(combat, named)

          await combat.clearSurprise()

          assert.isNull(storedSurprise(combat))
          assert.isNull(named("Orc 1").surprise)
        })
      })
    },
    { displayName: "BAGS: Surprise" },
  )
}
