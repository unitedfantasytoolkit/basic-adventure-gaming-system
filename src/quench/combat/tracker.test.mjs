/**
 * @file Integration tests for the combat tracker and the group manager.
 *
 * These cover the parts of the interface that are easy to break without
 * noticing: whether a group draws as one block, whether the initiative control
 * appears on the right row, and whether the group manager's controls actually
 * write anything. Several of them exist because the thing they check went wrong
 * once already -- the two "single root element" cases in particular, which
 * ApplicationV2 rejects at render time with no output at all.
 */

import {
  createTestCombat,
  cleanUpDocuments,
  createTestActor,
  settle,
  waitFor,
  withRenderedApplication,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the tracker test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerTrackerTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.tracker",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * Build a combat with two groups, and view it in the tracker.
       * @param {object} [options] - Fixture options.
       * @param {number} [options.party] - Combatants on the party side.
       * @param {number} [options.foes] - Combatants on the hostile side.
       * @param {number} [options.loose] - Combatants in no group at all.
       * @returns {Promise<object>} The combat and its groups.
       */
      const buildCombat = async ({ party = 2, foes = 2, loose = 0 } = {}) => {
        const combat = await createTestCombat()
        const actor = await createTestActor({ type: "monster" })

        // `createEmbeddedDocuments` does not promise to hand documents back in
        // the order it was given them, so look them up by side rather than by
        // position. Destructuring the returned array silently swapped these.
        const made = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
          { name: "Foes", system: { side: "hostile" } },
        ])
        const partyGroup = made.find((g) => g.system.side === "party")
        const foeGroup = made.find((g) => g.system.side === "hostile")

        const rows = (group, count) =>
          Array.from({ length: count }, () => ({
            actorId: actor.id,
            ...(group ? { group: group.id } : {}),
          }))

        await combat.createEmbeddedDocuments("Combatant", [
          ...rows(partyGroup, party),
          ...rows(foeGroup, foes),
          ...rows(null, loose),
        ])

        return { combat, partyGroup, foeGroup }
      }

      /**
       * Render the tracker against a given combat and hand back its element.
       * @param {Combat} combat - The combat to view.
       * @param {Function} callback - Receives the tracker's root element.
       * @returns {Promise<any>} Whatever the callback returns.
       */
      const withTracker = async (combat, callback) => {
        const previous = ui.combat.viewed
        try {
          await ui.combat.render({ force: true, combat })

          // Rendering is asynchronous and the tracker is shared between tests,
          // so a fixed pause can hand back the *previous* test's markup. Wait
          // until the rows on screen match the combat we asked for.
          await waitFor(
            () =>
              ui.combat.viewed?.id === combat.id &&
              ui.combat.element?.querySelectorAll(".combatant").length ===
                combat.turns.length,
            `the tracker to show combat ${combat.id}`,
          )

          return await callback(ui.combat.element)
        } finally {
          await ui.combat.render({ combat: previous ?? null })
          await settle()
        }
      }

      describe("Drawing rolling units", function units() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("offers one initiative adjustment per group", async () => {
          // A group has one roll. The control used to repeat down every
          // member's row, which read as though each could be moved alone.
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 2,
            foes: 3,
          })
          await partyGroup.update({ initiative: 4 })
          await foeGroup.update({ initiative: 2 })

          await withTracker(combat, (html) => {
            const controls = "[data-action='adjustInitiative']"
            assert.lengthOf(
              html.querySelectorAll(`.bags-unit__header ${controls}`),
              2,
            )
            assert.lengthOf(html.querySelectorAll(`.combatant ${controls}`), 0)
          })
        })

        it("draws one block per group, not one per combatant", async () => {
          const { combat } = await buildCombat({ party: 3, foes: 4 })
          await combat.rollAll()

          await withTracker(combat, (html) => {
            assert.lengthOf(html.querySelectorAll(".bags-unit"), 2)
            assert.lengthOf(html.querySelectorAll(".bags-unit__header"), 2)
            assert.lengthOf(
              html.querySelectorAll(".bags-unit__members .combatant"),
              7,
              "every combatant should still have a row inside its block",
            )
          })
        })

        it("renders at all -- a part must have a single root element", async () => {
          // ApplicationV2 refuses to render a part whose template produces more
          // than one root node, and fails with an empty tracker rather than a
          // visible error. This is the cheapest possible guard against that.
          const { combat } = await buildCombat()

          await withTracker(combat, (html) => {
            assert.isOk(
              html.querySelector(".combat-tracker"),
              "the tracker part rendered nothing",
            )
          })
        })

        it("puts the higher-rolling group first", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat()
          await partyGroup.update({ initiative: 2 })
          await foeGroup.update({ initiative: 5 })

          await withTracker(combat, (html) => {
            const names = [...html.querySelectorAll(".bags-unit__name")].map(
              (el) => el.textContent.trim(),
            )
            assert.deepEqual(names, ["Foes", "Party"])
          })
        })

        it("shows the group's roll once, on the block", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 3,
            foes: 0,
          })
          await partyGroup.update({ initiative: 4 })
          await foeGroup.delete()

          await withTracker(combat, (html) => {
            const scores = [...html.querySelectorAll(".bags-unit__score")].map(
              (el) => el.textContent.trim(),
            )
            assert.deepEqual(scores, ["4"])
            assert.lengthOf(
              html.querySelectorAll(".bags-unit__members .token-initiative"),
              0,
              "a grouped combatant should not offer its own initiative control",
            )
          })
        })

        it("leaves ungrouped combatants their own initiative control", async () => {
          // Under a side-initiative ruleset a lone combatant does not stay
          // lone: the grouping reconciler gathers it up moments after it enters
          // the encounter. Individual initiative is where "ungrouped" is the
          // ordinary state, so that is where this belongs.
          await withRulesModule(
            CONFIG.BAGS.SystemRegistry.categories.INITIATIVE,
            "bx-individual",
            async () => {
              const combat = await createTestCombat()
              const actor = await createTestActor({ type: "monster" })
              await combat.createEmbeddedDocuments("Combatant", [
                { actorId: actor.id },
              ])

              await withTracker(combat, (html) => {
                assert.lengthOf(html.querySelectorAll(".bags-unit__header"), 0)
                assert.lengthOf(
                  html.querySelectorAll(".token-initiative"),
                  1,
                  "an ungrouped combatant rolls for itself and needs the control",
                )
              })
            },
          )
        })

        it("offers a roll control on a group that has not rolled", async () => {
          const { combat } = await buildCombat()

          await withTracker(combat, (html) => {
            assert.lengthOf(
              html.querySelectorAll("[data-action='rollUnit']"),
              2,
              "both unrolled groups should offer a die",
            )
          })
        })
      })

      describe("Labelling", function labelling() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("hides the side label when it repeats the group's name", async () => {
          // Auto-created groups are named after their side, so showing both
          // would read "Party -- PARTY". The fixture's other group is named
          // "Foes" against the side "Enemies", which legitimately *does* show a
          // label -- so this has to look at the right block rather than the
          // first one to sort.
          const { combat, partyGroup } = await buildCombat()

          await withTracker(combat, (html) => {
            const unit = html.querySelector(
              `.bags-unit[data-unit-id="${partyGroup.id}"]`,
            )
            assert.isOk(unit, "the party's block should be on screen")
            assert.equal(
              unit.querySelector(".bags-unit__name").textContent.trim(),
              "Party",
            )
            assert.isNull(unit.querySelector(".bags-unit__side"))
          })
        })

        it("shows the side label once the group is renamed", async () => {
          const { combat, foeGroup } = await buildCombat()
          await foeGroup.update({ name: "Orc Warband" })

          await withTracker(combat, (html) => {
            const labels = [...html.querySelectorAll(".bags-unit__side")].map(
              (el) => el.textContent.trim(),
            )
            assert.include(labels.join(" "), "Enemies")
          })
        })

        it("colours a block from its side by default", async () => {
          const { combat } = await buildCombat({ party: 1, foes: 0 })

          await withTracker(combat, (html) => {
            const unit = html.querySelector(".bags-unit[data-side='party']")
            assert.include(
              unit.getAttribute("style") ?? "",
              "--bags-unit-accent",
            )
          })
        })

        it("prefers a colour the group was given", async () => {
          const { combat, partyGroup } = await buildCombat({
            party: 1,
            foes: 0,
          })
          await partyGroup.update({ "system.color": "#123456" })

          await withTracker(combat, (html) => {
            const unit = html.querySelector(".bags-unit[data-side='party']")
            assert.include(unit.getAttribute("style"), "#123456")
          })
        })
      })

      describe("The group manager", function manager() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        /**
         * Open the manager against a combat.
         * @param {Combat} combat - The combat to organise.
         * @param {Function} callback - Receives the app and its element.
         * @returns {Promise<any>} Whatever the callback returns.
         */
        const withManager = async (combat, callback) => {
          const { default: BAGSGroupManager } = await import(
            "../../combat/sidebar/group-manager.mjs"
          )
          const app = new BAGSGroupManager({ combat })
          return withRenderedApplication(app, () => callback(app, app.element))
        }

        it("renders -- a part must have a single root element", async () => {
          const { combat } = await buildCombat()

          await withManager(combat, (app, html) => {
            assert.isOk(
              html.querySelector(".bags-group-manager__wrap"),
              "the manager rendered nothing",
            )
          })
        })

        it("lists every group plus a home for the ungrouped", async () => {
          const { combat } = await buildCombat({ party: 2, foes: 2, loose: 1 })

          await withManager(combat, (app, html) => {
            // Two groups, plus the always-present loose section.
            assert.lengthOf(html.querySelectorAll(".bags-group-card"), 3)
            assert.lengthOf(html.querySelectorAll(".bags-group-row"), 5)
          })
        })

        it("moves a combatant into another group", async () => {
          const { combat, partyGroup, foeGroup } = await buildCombat({
            party: 1,
            foes: 1,
          })
          const mover = combat.combatants.find(
            (c) => c.rollingGroup?.id === partyGroup.id,
          )

          await withManager(combat, async (app, html) => {
            const select = html.querySelector(
              `[data-combatant-id="${mover.id}"] [data-change="assign"]`,
            )
            select.value = foeGroup.id
            select.dispatchEvent(new Event("change", { bubbles: true }))
            await waitFor(
              () => mover.rollingGroup?.id === foeGroup.id,
              "the combatant to move groups",
            )
          })

          assert.equal(mover.rollingGroup?.id, foeGroup.id)
        })

        it("takes a combatant out of every group", async () => {
          const { combat, partyGroup } = await buildCombat({
            party: 1,
            foes: 0,
          })
          const mover = combat.combatants.find(
            (c) => c.rollingGroup?.id === partyGroup.id,
          )

          await withManager(combat, async (app, html) => {
            const select = html.querySelector(
              `[data-combatant-id="${mover.id}"] [data-change="assign"]`,
            )
            select.value = ""
            select.dispatchEvent(new Event("change", { bubbles: true }))

            // The change handler is async and nothing awaits it, so watch for
            // the write rather than guessing how long it takes.
            await waitFor(
              () => mover.rollingGroup === null,
              "the combatant to leave its group",
            )
          })

          assert.isNull(mover.rollingGroup, "the combatant should be loose")
        })

        it("creates a group", async () => {
          const { combat } = await buildCombat()
          const before = combat.groups.size

          await withManager(combat, async (app, html) => {
            html.querySelector("[data-action='createGroup']").click()
            await waitFor(
              () => combat.groups.size === before + 1,
              "the new group to be created",
            )
          })

          assert.equal(combat.groups.size, before + 1)
        })

        it("deletes a group and releases its members", async () => {
          const { combat, partyGroup } = await buildCombat({
            party: 2,
            foes: 0,
          })

          await withManager(combat, async (app, html) => {
            html
              .querySelector(
                `[data-group-id="${partyGroup.id}"] [data-action='deleteGroup']`,
              )
              .click()

            // Deleting releases the members first, then removes the group, and
            // none of that is awaited by the click.
            await waitFor(
              () =>
                !combat.groups.get(partyGroup.id) &&
                combat.combatants.every((c) => !c._source.group),
              "the group to be deleted and its members released",
            )
          })

          assert.isUndefined(combat.groups.get(partyGroup.id))
          combat.combatants.forEach((combatant) =>
            assert.isNull(
              combatant._source.group || null,
              "a former member kept a reference to the deleted group",
            ),
          )
        })

        it("changes a group's side", async () => {
          const { combat, partyGroup } = await buildCombat()

          await withManager(combat, async (app, html) => {
            const select = html.querySelector(
              `[data-group-id="${partyGroup.id}"] [data-change="side"]`,
            )
            select.value = "neutral"
            select.dispatchEvent(new Event("change", { bubbles: true }))
            await waitFor(
              () => partyGroup.system.side === "neutral",
              "the group's side to change",
            )
          })

          assert.equal(partyGroup.system.side, "neutral")
        })

        it("gives a group its own colour, and hands it back", async () => {
          const { combat, partyGroup } = await buildCombat()

          await withManager(combat, async (app, html) => {
            const input = html.querySelector(
              `[data-group-id="${partyGroup.id}"] [data-change="color"]`,
            )
            input.value = "#abcdef"
            input.dispatchEvent(new Event("change", { bubbles: true }))
            await waitFor(
              () => partyGroup.system.color?.css === "#abcdef",
              "the group's colour to be set",
            )
          })
          assert.equal(partyGroup.system.color?.css, "#abcdef")

          await withManager(combat, async (app, html) => {
            html
              .querySelector(
                `[data-group-id="${partyGroup.id}"] [data-action='resetColor']`,
              )
              .click()
            await waitFor(
              () => partyGroup.system.color === null,
              "the group's colour to be handed back",
            )
          })
          assert.isNull(
            partyGroup.system.color,
            "resetting should hand the colour back to the side",
          )
        })
      })
    },
    { displayName: "BAGS: Combat Tracker" },
  )
}
