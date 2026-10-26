/**
 * @file Integration tests for moving the turn cursor, the order it moves
 * through, and the movement bars that ride along with it.
 *
 * Side initiative steps a whole side per click. That is a different walk from
 * core's one-row-at-a-time one, so core's own rules -- skipping the defeated,
 * stepping back -- had to be written again for it, and are checked here.
 */

import {
  cleanUpDocuments,
  createTestActor,
  createTestCombat,
  createTestScene,
  createTestToken,
  waitFor,
} from "../helpers.mjs"

/**
 * Run a callback with core's Skip Defeated setting turned on.
 * @param {Function} callback - The work to do.
 * @returns {Promise<any>} Whatever the callback returns.
 */
const withSkipDefeated = async (callback) => {
  const key = foundry.documents.Combat.CONFIG_SETTING
  const original = game.settings.get("core", key)
  await game.settings.set("core", key, { ...original, skipDefeated: true })
  try {
    return await callback()
  } finally {
    await game.settings.set("core", key, original)
  }
}

/**
 * Register the turn stepping test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSteppingTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.stepping",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A started fight: a hero at 5, then two orcs at 3. Rolls are kept from
       * round to round, so a new round does not reshuffle the order.
       * @param {object} [system] - Per-encounter rule overrides.
       * @returns {Promise<object>} The combat and a name lookup.
       */
      const buildFight = async (system = {}) => {
        const combat = await createTestCombat({
          system: { rerollCadence: "keep", ...system },
        })
        const actor = await createTestActor({ type: "monster" })
        const groups = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
          { name: "Orcs", system: { side: "hostile" } },
        ])
        const party = groups.find((group) => group.name === "Party")
        const orcs = groups.find((group) => group.name === "Orcs")
        await combat.createEmbeddedDocuments("Combatant", [
          { actorId: actor.id, group: party.id, name: "Hero" },
          { actorId: actor.id, group: orcs.id, name: "Orc 1" },
          { actorId: actor.id, group: orcs.id, name: "Orc 2" },
        ])
        await party.update({ initiative: 5 })
        await orcs.update({ initiative: 3 })
        await combat.startCombat()

        const named = (name) => combat.combatants.find((c) => c.name === name)
        return { combat, named }
      }

      describe("Stepping the cursor", function stepping() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("steps a whole side at a time", async () => {
          const { combat } = await buildFight()
          assert.equal(combat.combatant.name, "Hero")

          await combat.nextTurn()
          assert.equal(combat.turn, 1, "onto the orcs")

          await combat.nextTurn()
          assert.equal(combat.round, 2, "past both orcs in one step")
        })

        it("steps one combatant at a time when told to", async () => {
          const { combat } = await buildFight({
            turnGranularity: "combatant",
          })

          await combat.nextTurn()
          await combat.nextTurn()

          assert.equal(combat.round, 1)
          assert.equal(combat.turn, 2)
        })

        it("steps back to where the previous side began", async () => {
          const { combat } = await buildFight()
          await combat.nextTurn()
          assert.equal(combat.turn, 1)

          await combat.previousTurn()

          assert.equal(combat.turn, 0)
        })

        it("lands on a side's first member still standing", async () => {
          await withSkipDefeated(async () => {
            const { combat } = await buildFight()
            await combat.turns[1].update({ defeated: true })

            await combat.nextTurn()

            assert.equal(combat.turn, 2)
            assert.isFalse(combat.combatant.isDefeated)
          })
        })

        it("gives a side with nobody standing no stop at all", async () => {
          await withSkipDefeated(async () => {
            const { combat, named } = await buildFight()
            await named("Orc 1").update({ defeated: true })
            await named("Orc 2").update({ defeated: true })

            await combat.nextTurn()

            assert.equal(combat.round, 2, "straight on to the next round")
            assert.equal(combat.combatant.name, "Hero")
          })
        })
      })

      describe("Phases", function phases() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        /**
         * A B/X fight in which the party declares three different things.
         * @param {object} [system] - Per-encounter rule overrides.
         * @returns {Promise<object>} The combat and a name lookup.
         */
        const buildPhasedFight = async (system = {}) => {
          const combat = await createTestCombat({
            system: {
              rerollCadence: "keep",
              declarationMode: "optional",
              ...system,
            },
          })
          const actor = await createTestActor({ type: "monster" })
          const groups = await combat.createEmbeddedDocuments(
            "CombatantGroup",
            [
              { name: "Party", system: { side: "party" } },
              { name: "Orcs", system: { side: "hostile" } },
            ],
          )
          const party = groups.find((group) => group.name === "Party")
          const orcs = groups.find((group) => group.name === "Orcs")
          const declared = (type) => ({ system: { declaration: { type } } })
          await combat.createEmbeddedDocuments("Combatant", [
            {
              actorId: actor.id,
              group: party.id,
              name: "Fighter",
              ...declared("bags.melee"),
            },
            {
              actorId: actor.id,
              group: party.id,
              name: "Runner",
              ...declared("bags.move"),
            },
            {
              actorId: actor.id,
              group: party.id,
              name: "Mage",
              ...declared("bags.cast"),
            },
            {
              actorId: actor.id,
              group: orcs.id,
              name: "Orc",
              ...declared("bags.move"),
            },
          ])
          await party.update({ initiative: 5 })
          await orcs.update({ initiative: 3 })

          const named = (name) => combat.combatants.find((c) => c.name === name)
          return { combat, named }
        }

        it("orders a side by phase: move, missiles, magic, melee", async () => {
          const { combat } = await buildPhasedFight()

          assert.deepEqual(
            combat.turns.map((c) => c.name),
            ["Runner", "Mage", "Fighter", "Orc"],
            "the orcs' mover still waits for the winning side to finish",
          )
        })

        it("labels the phases in the side's block", async () => {
          const { combat } = await buildPhasedFight()
          const previous = ui.combat.viewed
          try {
            await ui.combat.render({ force: true, combat })
            await waitFor(
              () => ui.combat.viewed?.id === combat.id,
              "the tracker to show the test combat",
            )
            const party = ui.combat.element.querySelector(
              `[data-unit-id="${combat.groups.find((g) => g.name === "Party").id}"]`,
            )
            const headings = [
              ...party.querySelectorAll(".bags-unit__phase"),
            ].map((el) => el.textContent.trim())

            assert.deepEqual(headings, [
              game.i18n.localize("BAGS.Combat.Phases.Movement"),
              game.i18n.localize("BAGS.Combat.Phases.Magic"),
              game.i18n.localize("BAGS.Combat.Phases.Melee"),
            ])
          } finally {
            await ui.combat.render({ combat: previous ?? null })
          }
        })

        it("leaves declarations open while stepping by side", async () => {
          const { combat, named } = await buildPhasedFight()
          await combat.startCombat()

          assert.isFalse(named("Fighter").declarationsLocked)
        })

        it("settles them when stepping one combatant at a time", async () => {
          // A reshuffled side could otherwise put someone who has acted back
          // in front of the cursor.
          const { combat, named } = await buildPhasedFight({
            turnGranularity: "combatant",
          })
          await combat.startCombat()

          assert.isTrue(named("Fighter").declarationsLocked)
        })
      })

      describe("Movement bars", function movement() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("redraws the tracker when a combatant's token moves", async () => {
          // Found by playing, not by testing: bars only caught up when
          // something unrelated redrew the tracker. Checked by the redraw
          // rather than the bar's number, because movement cost is measured on
          // the canvas, and a test scene is not the one on screen.
          const scene = await createTestScene()
          const actor = await createTestActor({ type: "monster" })
          const token = await createTestToken(scene, actor)
          const combat = await createTestCombat()
          await combat.createEmbeddedDocuments("Combatant", [
            { tokenId: token.id, sceneId: scene.id, actorId: actor.id },
          ])
          await combat.startCombat()

          const previous = ui.combat.viewed
          let redraws = 0
          const hook = Hooks.on("renderCombatTracker", () => {
            redraws += 1
          })
          try {
            await ui.combat.render({ force: true, combat })
            await waitFor(
              () => ui.combat.viewed?.id === combat.id,
              "the tracker to show the test combat",
            )
            redraws = 0

            await token.move({ x: token.x + scene.grid.size * 2, y: token.y })

            assert.isNotEmpty(token.movementHistory, "the move was recorded")
            await waitFor(() => redraws > 0, "the tracker to redraw")
          } finally {
            Hooks.off("renderCombatTracker", hook)
            await ui.combat.render({ combat: previous ?? null })
          }
        })
      })
    },
    { displayName: "BAGS: Turn Stepping" },
  )
}
