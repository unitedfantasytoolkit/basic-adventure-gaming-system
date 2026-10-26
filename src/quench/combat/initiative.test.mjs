/**
 * @file Integration tests for group initiative.
 *
 * The turn-ordering engine itself is covered by unit tests, which is where the
 * rules risk lives. What can only be checked in a running world is whether
 * Foundry's own combat machinery behaves once a *group* holds the initiative
 * roll rather than a combatant -- four of its methods quietly do the wrong thing,
 * and the whole point of the Combat subclass is to take those over.
 */

import {
  createTestCombat,
  cleanUpDocuments,
  createTestActor,
  waitFor,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the group initiative test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerInitiativeTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.initiative",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * Build a combat with two groups and some combatants in each.
       *
       * Combatants are created without tokens. Foundry allows that -- `tokenId`
       * is nullable -- and it keeps the fixture from needing a scene.
       * @param {object} [options] - Fixture options.
       * @param {number} [options.party] - How many combatants on the party side.
       * @param {number} [options.foes] - How many on the hostile side.
       * @returns {Promise<object>} The combat and its groups.
       */
      const buildCombat = async ({ party = 2, foes = 3 } = {}) => {
        const combat = await createTestCombat()

        // `createEmbeddedDocuments` does not promise to hand documents back in
        // the order it was given them, so look them up by side rather than by
        // position. Destructuring the returned array silently swapped these.
        const made = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
          { name: "Foes", system: { side: "hostile" } },
        ])
        const partyGroup = made.find((g) => g.system.side === "party")
        const foeGroup = made.find((g) => g.system.side === "hostile")

        const actor = await createTestActor({ type: "monster" })

        const make = (group, count) =>
          Array.from({ length: count }, () => ({
            actorId: actor.id,
            group: group.id,
          }))

        await combat.createEmbeddedDocuments("Combatant", [
          ...make(partyGroup, party),
          ...make(foeGroup, foes),
        ])

        return { combat, partyGroup, foeGroup }
      }

      describe("Initiative is inherited from the rolling unit", function inheritance() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("gives every member of a group the group's roll", async () => {
          const { combat, partyGroup } = await buildCombat({
            party: 3,
            foes: 0,
          })

          await partyGroup.update({ initiative: 4 })

          const members = combat.combatants.filter(
            (combatant) => combatant.rollingGroup?.id === partyGroup.id,
          )
          assert.isAbove(members.length, 0, "fixture produced no members")
          members.forEach((combatant) =>
            assert.equal(
              combatant.initiative,
              4,
              `${combatant.id} did not inherit the group's roll`,
            ),
          )
        })

        it("leaves an ungrouped combatant rolling for itself", async () => {
          const combat = await createTestCombat()
          const actor = await createTestActor({ type: "monster" })
          const [combatant] = await combat.createEmbeddedDocuments(
            "Combatant",
            [{ actorId: actor.id }],
          )

          await combatant.update({ initiative: 7 })

          assert.isNull(
            combatant.rollingGroup,
            "combatant should not be in a group",
          )
          assert.equal(combatant.initiative, 7)
        })

        it("does not compound the offset when data is prepared twice", async () => {
          // Preparation can run more than once for a single document. An
          // implementation that read its own previous output would drift.
          const { combat, partyGroup } = await buildCombat({
            party: 1,
            foes: 0,
          })
          await partyGroup.update({ initiative: 5 })

          const combatant = combat.combatants.contents[0]
          combatant.prepareData()
          combatant.prepareData()

          assert.equal(combatant.initiative, 5)
        })

        it("survives its group being deleted", async () => {
          // Foundry does not cascade group deletion, so the members are released
          // explicitly. Even if that failed, a dangling reference must not strand
          // a combatant without an initiative score.
          const { combat, partyGroup } = await buildCombat({
            party: 2,
            foes: 0,
          })
          await partyGroup.update({ initiative: 3 })
          await partyGroup.delete()

          combat.combatants.forEach((combatant) => {
            assert.isNull(
              combatant._source.group || null,
              "combatant still points at the deleted group",
            )
            assert.isNull(combatant.rollingGroup)
          })
        })
      })

      describe("Rolling happens once per unit", function rolling() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("rolls once for a group, not once per member", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 4,
            foes: 3,
          })

          await combat.rollAll()

          assert.isTrue(
            Number.isFinite(partyGroup.initiative),
            "the party group did not roll",
          )
          assert.isTrue(
            Number.isFinite(foeGroup.initiative),
            "the enemy group did not roll",
          )

          // Seven combatants, but only two distinct scores are possible.
          const scores = new Set(
            combat.combatants.map((combatant) => combatant.initiative),
          )
          assert.isAtMost(
            scores.size,
            2,
            "members of a group ended up with different scores",
          )
        })

        it("rolling one member rolls its whole group", async () => {
          const { combat, partyGroup } = await buildCombat({
            party: 3,
            foes: 0,
          })
          const [first] = combat.combatants.contents

          await combat.rollInitiative([first.id])

          assert.isTrue(Number.isFinite(partyGroup.initiative))
        })

        it("clears group scores as well as combatant scores", async () => {
          // Foundry's own resetAll only iterates combatants, so under group
          // initiative it clears values that are re-derived a moment later --
          // the button appears to do nothing at all.
          const { combat, partyGroup } = await buildCombat({
            party: 2,
            foes: 2,
          })
          await combat.rollAll()
          assert.isTrue(Number.isFinite(partyGroup.initiative))

          await combat.resetAll()

          assert.isNull(partyGroup.initiative, "the group kept its roll")
          combat.combatants.forEach((combatant) =>
            assert.isNull(
              combatant.initiative,
              "a combatant kept a derived score",
            ),
          )
        })
      })

      describe("Turn order", function turnOrder() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("keeps each group's members together", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 3,
            foes: 3,
          })

          await partyGroup.update({ initiative: 5 })
          await foeGroup.update({ initiative: 2 })

          const order = combat.turns.map(
            (combatant) => combatant.rollingGroup?.id,
          )
          const boundaries = order.filter(
            (id, index) => index > 0 && id !== order[index - 1],
          )

          assert.equal(
            boundaries.length,
            1,
            "the two groups interleaved instead of forming blocks",
          )
          assert.equal(
            order[0],
            partyGroup.id,
            "the higher roll did not act first",
          )
        })

        it("sorts unrolled units last", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 1,
            foes: 1,
          })

          await foeGroup.update({ initiative: 1 })

          assert.equal(
            combat.turns[0].rollingGroup?.id,
            foeGroup.id,
            "a rolled unit should act before an unrolled one",
          )
          assert.equal(combat.turns[1].rollingGroup?.id, partyGroup.id)
        })

        it("advances the cursor a whole unit at a time", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 3,
            foes: 3,
          })

          await withRulesModule(
            CONFIG.BAGS.SystemRegistry.categories.INITIATIVE,
            "bx-group",
            async () => {
              await partyGroup.update({ initiative: 5 })
              await foeGroup.update({ initiative: 2 })
              await combat.update({ round: 1, turn: 0 })

              assert.equal(
                combat.initiativeConfig.granularity,
                "unit",
                "fixture is not running under unit granularity",
              )

              await combat.nextTurn()

              // Three party members were skipped in one step.
              assert.equal(combat.turn, 3)
              assert.equal(combat.combatant.rollingGroup?.id, foeGroup.id)
            },
          )
        })

        it("does not report a stepped-past unit's turns as skipped", async () => {
          // Core flags every intermediate combatant `skipped: true` and reserves
          // `false` for the one the cursor lands on. That flag reaches
          // `ActiveEffect.registry.refresh` and region events, where handlers
          // read it as "fast-forwarded, do not apply" -- so an effect that
          // should expire on the third orc's turn quietly runs long, and only in
          // group-initiative games.
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 3,
            foes: 2,
          })

          await withRulesModule(
            CONFIG.BAGS.SystemRegistry.categories.INITIATIVE,
            "bx-group",
            async () => {
              await combat.startCombat()
              await partyGroup.update({ initiative: 5 })
              await foeGroup.update({ initiative: 2 })
              await combat.update({ round: 1, turn: 0 })

              const seen = []
              const original = combat._onStartTurn.bind(combat)
              // Recorded *after* the handler runs, because that is when core
              // reads it: `#onStartTurn` calls `_onStartTurn` and only then
              // spreads the context into the effect refresh and region events
              // (`combat.mjs:1075-1078`). Observing it beforehand would test the
              // flag core computed rather than the one anything acts on.
              combat._onStartTurn = async (combatant, turnContext) => {
                const result = await original(combatant, turnContext)
                seen.push({
                  name: combatant.name,
                  skipped: turnContext.skipped,
                })
                return result
              }

              try {
                await combat.nextTurn()
                // Turn events are dispatched from `_onUpdate` on the active
                // GM's client, after the update promise has already resolved.
                await waitFor(() => seen.length > 0, "turn events to fire")
              } finally {
                delete combat._onStartTurn
              }

              assert.isNotEmpty(seen, "turn events should have fired at all")
              assert.isTrue(
                seen.every((turn) => turn.skipped === false),
                "every turn played in one step should report as played",
              )
            },
          )
        })

        it("still reports genuinely skipped rounds as skipped", async () => {
          // The correction above must not swallow the real case. Jumping rounds
          // passes over turns nobody played -- including later rounds' turns
          // belonging to the very unit the cursor was sitting in, which is the
          // case that needs the round check rather than the unit check alone.
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 2,
            foes: 2,
          })

          await withRulesModule(
            CONFIG.BAGS.SystemRegistry.categories.INITIATIVE,
            "bx-group",
            async () => {
              await combat.startCombat()
              await partyGroup.update({ initiative: 5 })
              await foeGroup.update({ initiative: 2 })
              await combat.update({ round: 1, turn: 0 })

              const seen = []
              const original = combat._onStartTurn.bind(combat)
              combat._onStartTurn = async (combatant, turnContext) => {
                const result = await original(combatant, turnContext)
                seen.push({
                  round: turnContext.round,
                  skipped: turnContext.skipped,
                })
                return result
              }

              try {
                await combat.update({ round: 3, turn: 0 })
                await waitFor(
                  () => seen.some((turn) => turn.round === 2),
                  "the jumped-over round to be walked",
                )
              } finally {
                delete combat._onStartTurn
              }

              const jumped = seen.filter((turn) => turn.round === 2)
              assert.isNotEmpty(jumped, "round 2 should have been walked")
              assert.isTrue(
                jumped.every((turn) => turn.skipped === true),
                "a round nobody played is skipped, whatever unit it belonged to",
              )
            },
          )
        })
      })
    },
    { displayName: "BAGS: Group Initiative" },
  )
}
