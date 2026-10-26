/**
 * @file Integration tests for declared actions.
 *
 * The pool's own contract is unit-tested. What needs a live world is the part
 * that ties a declaration to the turn order: a ruleset reading declarations and
 * moving members of one side to different points in the round, which is the case
 * the whole offset mechanism exists for.
 */

import { captureRound, findRoundCard } from "../../combat/round-card.mjs"
import {
  createTestCombat,
  cleanUpDocuments,
  createTestActor,
  settle,
  trackDocument,
  waitFor,
  withRenderedApplication,
  withSetting,
} from "../helpers.mjs"

/** A throwaway ruleset that turns declarations into offsets, as AD&D does. */
const PROBE_RULES = {
  id: "quench-declarations",
  name: "Quench: Declarations",
  ruleset: "quench",
  formula: "1d6",
  decimals: 0,
  direction: "high",
  rollingUnit: "group",
  perMemberOffsets: true,
  /**
   * Mimic a speed factor: casting is slow, loosing an arrow is quick.
   * @param {object} context - The offset context.
   * @param context.declarationType
   * @returns {number} The adjustment.
   */
  getInitiativeOffset({ declarationType }) {
    if (declarationType.id === "bags.cast") return -3
    if (declarationType.id === "bags.missile") return 2
    return 0
  },
}

/**
 * Register the declarations test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerDeclarationTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.declarations",
    (context) => {
      const { describe, it, assert, after, before } = context

      before(() => {
        const registry = CONFIG.BAGS.SystemRegistry
        registry.register(registry.categories.INITIATIVE, PROBE_RULES)
      })

      /**
       * A combat running the probe ruleset, with a side of three.
       *
       * The ruleset is set per-encounter rather than as a world setting, which
       * keeps the rest of the world on its own rules while these run.
       * @returns {Promise<object>} The combat, its group, and its combatants.
       */
      const buildCombat = async () => {
        const combat = trackDocument(
          await Combat.implementation.create({
            system: { initiativePreset: PROBE_RULES.id },
          }),
        )
        const actor = await createTestActor({ type: "monster" })
        const [group] = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
        ])
        await combat.createEmbeddedDocuments("Combatant", [
          { actorId: actor.id, group: group.id, name: "Caster" },
          { actorId: actor.id, group: group.id, name: "Archer" },
          { actorId: actor.id, group: group.id, name: "Fighter" },
        ])

        const named = (name) => combat.combatants.find((c) => c.name === name)

        return { combat, group, named }
      }

      describe("Declarations and the turn order", function ordering() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("resolves an undeclared combatant to a record, not to null", async () => {
          const { named } = await buildCombat()
          assert.equal(named("Fighter").declarationType.id, "bags.none")
          assert.isNull(named("Fighter").declaration)
        })

        it("leaves the order alone when nobody has declared", async () => {
          const { combat, group } = await buildCombat()
          await group.update({ initiative: 5 })

          combat.combatants.forEach((c) => assert.equal(c.initiative, 5))
        })

        it("splits one side's members apart by what they declared", async () => {
          // The case the whole offset mechanism exists for: a single side roll,
          // and members acting at different points because of their actions.
          const { combat, group, named } = await buildCombat()
          await group.update({ initiative: 5 })

          await named("Caster").update({
            "system.declaration.type": "bags.cast",
          })
          await named("Archer").update({
            "system.declaration.type": "bags.missile",
          })
          await waitFor(
            () => named("Archer").initiative === 7,
            "the archer's offset to apply",
          )

          assert.equal(named("Archer").initiative, 7, "quick action")
          assert.equal(named("Fighter").initiative, 5, "no declaration")
          assert.equal(named("Caster").initiative, 2, "slow action")

          assert.deepEqual(
            combat.turns.map((t) => t.name),
            ["Archer", "Fighter", "Caster"],
          )
        })

        it("does not compound the offset across preparations", async () => {
          const { group, named } = await buildCombat()
          await group.update({ initiative: 5 })
          await named("Archer").update({
            "system.declaration.type": "bags.missile",
          })
          await waitFor(
            () => named("Archer").initiative === 7,
            "the offset to apply",
          )

          named("Archer").prepareData()
          named("Archer").prepareData()

          assert.equal(named("Archer").initiative, 7)
        })

        it("keeps the group's own roll unchanged", async () => {
          // The offset belongs to the combatant. The unit's roll is the base
          // everyone works from and must not drift.
          const { group, named } = await buildCombat()
          await group.update({ initiative: 5 })
          await named("Caster").update({
            "system.declaration.type": "bags.cast",
          })
          await waitFor(
            () => named("Caster").initiative === 2,
            "the offset to apply",
          )

          assert.equal(group.initiative, 5)
        })
      })

      describe("Whose declaration counts", function precedence() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("falls back to the group's declaration", async () => {
          const { group, named } = await buildCombat()
          await group.update({ "system.declaration.type": "bags.cast" })

          assert.equal(named("Fighter").declarationType.id, "bags.cast")
        })

        it("lets a combatant overrule the mob it belongs to", async () => {
          // Being swept into the party group should not cost a player the
          // ability to say what they personally are doing.
          const { group, named } = await buildCombat()
          await group.update({ "system.declaration.type": "bags.cast" })
          await named("Archer").update({
            "system.declaration.type": "bags.missile",
          })

          assert.equal(named("Archer").declarationType.id, "bags.missile")
          assert.equal(named("Fighter").declarationType.id, "bags.cast")
        })
      })

      describe("The declaration dialog", function dialog() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        /**
         * Open the dialog for a combatant.
         * @param {Combatant} combatant - Who is declaring.
         * @param {Function} callback - Receives the app and its element.
         * @returns {Promise<any>} Whatever the callback returns.
         */
        const withDialog = async (combatant, callback) => {
          const { default: Dialog } = await import(
            "../../combat/sidebar/declaration.mjs"
          )
          const app = new Dialog({ combatant })
          return withRenderedApplication(app, () => callback(app, app.element))
        }

        it("renders -- a part must have a single root element", async () => {
          const { named } = await buildCombat()

          await withDialog(named("Fighter"), (app, html) => {
            assert.isOk(html.querySelector(".bags-declaration__wrap"))
          })
        })

        it("offers every universal action but not 'undeclared'", async () => {
          const { named } = await buildCombat()

          await withDialog(named("Fighter"), (app, html) => {
            const ids = [...html.querySelectorAll("input[name='type']")].map(
              (radio) => radio.value,
            )

            assert.include(ids, "bags.melee")
            assert.include(ids, "bags.cast")
            assert.notInclude(
              ids,
              "bags.none",
              "the absence of a choice is not a choice",
            )
          })
        })

        it("writes the declaration and fires the hook", async () => {
          const { named } = await buildCombat()
          const combatant = named("Fighter")
          const seen = []
          const hookId = Hooks.on("BAGS.declareAction", (c, id) =>
            seen.push(id),
          )

          try {
            await withDialog(combatant, async (app, html) => {
              // Choosing then submitting, rather than one click that does both.
              // Some actions need a number supplied alongside them, and a button
              // that commits the moment it is pressed leaves nowhere to ask.
              html
                .querySelector("input[name='type'][value='bags.melee']")
                .click()
              html.querySelector(".bags-declaration__submit").click()

              await waitFor(
                () => combatant.system.declaration.type === "bags.melee",
                "the declaration to be written",
              )
            })
          } finally {
            Hooks.off("BAGS.declareAction", hookId)
          }

          assert.equal(combatant.declarationType.id, "bags.melee")
          assert.deepEqual(seen, ["bags.melee"])
        })

        it("submitting with nothing chosen writes nothing", async () => {
          // A radio list opens with no option selected when the combatant has
          // not declared. Pressing the submit button in that state must not
          // write an empty declaration over whatever is there.
          const { named } = await buildCombat()
          const combatant = named("Fighter")

          await withDialog(combatant, async (app, html) => {
            html.querySelector(".bags-declaration__submit").click()
            await new Promise((resolve) => {
              setTimeout(resolve, 200)
            })
          })

          assert.equal(combatant.declarationType.id, "bags.none")
        })

        it("carries a declared action's own numbers back into the form", async () => {
          // A casting time belongs to the action that asked for it. Reopening
          // the dialog has to show what was declared rather than the default,
          // or a player checking their own declaration would silently reset it.
          const { named } = await buildCombat()
          const combatant = named("Fighter")

          // "Cast a spell" only asks for a casting time in AD&D, and there is no
          // AD&D preset yet, so the field is widened for the length of this test.
          const cast = CONFIG.BAGS.declarationTypes["bags.cast"]
          CONFIG.BAGS.declarationTypes["bags.cast"] = Object.freeze({
            ...cast,
            fields: {
              castingTime: { ...cast.fields.castingTime, appliesTo: "*" },
            },
          })

          try {
            await combatant.update({
              system: {
                declaration: { type: "bags.cast", values: { castingTime: 5 } },
              },
            })

            await withDialog(combatant, (app, html) => {
              const group = html.querySelector("[data-fields-for='bags.cast']")
              assert.isFalse(
                group.hidden,
                "the declared action's fields should be showing",
              )
              assert.equal(
                group.querySelector("input[name='values.castingTime']").value,
                "5",
              )
            })
          } finally {
            CONFIG.BAGS.declarationTypes["bags.cast"] = cast
          }
        })

        it("writes it in a shape a player is actually allowed to send", async () => {
          // Foundry decides whether a non-GM may update a Combatant by testing
          // `Object.keys(data)` against a list of top-level fields. A key of
          // "system.declaration.type" is not "system", so the update is refused
          // -- silently, and only for players. A GM bypasses the check, so a
          // test that only ever runs as one will never see this.
          const { named } = await buildCombat()
          const combatant = named("Fighter")
          const player = game.users.find((u) => !u.isGM)

          if (!player) {
            assert.ok(true, "no non-GM user in this world to check against")
            return
          }

          // The check this test is about only runs for a user who already owns
          // the combatant; without this it would pass for the wrong reason.
          await combatant.actor.update({
            [`ownership.${player.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
          })
          assert.isTrue(
            combatant.testUserPermission(player, "OWNER"),
            "fixture failed to give the player ownership",
          )

          assert.isFalse(
            combatant.canUserModify(player, "update", {
              "system.declaration.type": "bags.melee",
            }),
            "dot notation should be refused for a player -- do not use it",
          )
          assert.isTrue(
            combatant.canUserModify(player, "update", {
              system: { declaration: { type: "bags.melee" } },
            }),
            "the nested form is what the dialog must send",
          )
        })

        it("settles a declaration once the round begins", async () => {
          // A declaration is a commitment made before anyone acts. It is also a
          // correctness matter: changing one changes the offset, which changes
          // the segment, which re-sorts the turn order -- and can drop a
          // combatant who has already acted back in front of the cursor.
          await withSetting("declarationMode", "optional", async () => {
            const { combat, group, named } = await buildCombat()
            const combatant = named("Fighter")
            // Rolling by hand keeps each round waiting until the dice come out,
            // which gives the test a between-rounds window with no player.
            await combat.update({ system: { rerollCadence: "reset" } })

            assert.isFalse(
              combatant.declarationsLocked,
              "nothing is settled before the fight",
            )

            await combat.startCombat()
            assert.isTrue(combat.betweenRounds, "round one should be waiting")
            assert.isFalse(
              combatant.declarationsLocked,
              "a round that has not begun is still taking declarations",
            )

            await group.update({ initiative: 3 })
            await waitFor(
              () => combatant.declarationsLocked,
              "the round to begin and settle the declaration",
            )

            await combat.nextRound()
            await waitFor(
              () => combat.betweenRounds && !combatant.declarationsLocked,
              "the next round to reopen declarations",
            )
          })
        })

        it("leaves declarations open in a ruleset with no offsets", async () => {
          // Nothing to protect: in the Basic/Expert family every member of a
          // side shares its roll, so a late declaration moves nobody.
          await withSetting("declarationMode", "optional", async () => {
            const combat = await createTestCombat()
            const actor = await createTestActor({ type: "monster" })
            const [side] = await combat.createEmbeddedDocuments(
              "CombatantGroup",
              [{ name: "Party", system: { side: "party" } }],
            )
            await combat.createEmbeddedDocuments("Combatant", [
              { actorId: actor.id, group: side.id, name: "Aldric" },
            ])
            await combat.startCombat()
            await side.update({ initiative: 4 })

            assert.isFalse(combat.combatants.contents[0].declarationsLocked)
          })
        })

        it("never settles anything while declarations are off", async () => {
          await withSetting("declarationMode", "off", async () => {
            const { combat, group, named } = await buildCombat()
            await combat.startCombat()
            await group.update({ initiative: 3 })

            assert.isFalse(named("Fighter").declarationsLocked)
          })
        })

        it("lets a combatant take a declaration back", async () => {
          const { named } = await buildCombat()
          const combatant = named("Fighter")
          await combatant.update({ "system.declaration.type": "bags.melee" })

          await withDialog(combatant, async (app, html) => {
            html.querySelector("[data-action='clearDeclaration']").click()
            await waitFor(
              () => combatant.system.declaration.type === "",
              "the declaration to be withdrawn",
            )
          })

          assert.equal(combatant.declarationType.id, "bags.none")
        })
      })

      describe("The tracker", function tracker() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("offers no declaration control when declarations are off", async () => {
          const { combat } = await buildCombat()

          await withSetting("declarationMode", "off", async () => {
            await ui.combat.render({ force: true, combat })
            await settle()
            assert.lengthOf(
              ui.combat.element.querySelectorAll(
                "[data-action='declareAction']",
              ),
              0,
            )
          })
        })

        it("offers one per owned combatant when they are on", async () => {
          const { combat } = await buildCombat()

          await withSetting("declarationMode", "optional", async () => {
            await ui.combat.render({ force: true, combat })
            await waitFor(
              () =>
                ui.combat.element.querySelectorAll(
                  "[data-action='declareAction']",
                ).length === 3,
              "a declaration control on each row",
            )
          })
        })
      })

      describe("Blind declarations", function blind() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        /**
         * The Caster's line on a freshly captured round card.
         * @param {Combat} combat - The encounter.
         * @returns {object|undefined} The member payload.
         */
        const casterLine = (combat) =>
          captureRound(combat)
            .units.flatMap((unit) => unit.members)
            .concat(captureRound(combat).segments.flatMap((s) => s.members))
            .concat(captureRound(combat).pending)
            .find((member) => member.name === "Caster")

        /**
         * A probe combat that waits for the referee's dice each round, with the
         * Caster declaring a spell.
         * @returns {Promise<object>} The combat, its group, and its combatants.
         */
        const buildBlindCombat = async () => {
          const built = await buildCombat()
          await built.combat.update({
            system: { declarationMode: "optional", rerollCadence: "reset" },
          })
          await built.named("Caster").update({
            system: { declaration: { type: "bags.cast" } },
          })
          return built
        }

        const HIDDEN = () =>
          game.i18n.localize("BAGS.Combat.Declarations.Hidden")
        const CAST = () =>
          game.i18n.localize("BAGS.Combat.Declarations.Cast.Label")

        it("says only that someone declared until the round begins", async () => {
          await withSetting("blindDeclarations", true, async () => {
            const { combat, group } = await buildBlindCombat()
            assert.isTrue(combat.declarationsHidden)
            assert.equal(casterLine(combat).declarationLabel, HIDDEN())

            await combat.startCombat()
            assert.isTrue(combat.betweenRounds, "waiting on the dice")
            assert.isTrue(combat.declarationsHidden, "still hidden")

            await group.update({ initiative: 3 })
            await waitFor(() => !combat.betweenRounds, "the round to begin")

            assert.isFalse(combat.declarationsHidden)
            assert.equal(casterLine(combat).declarationLabel, CAST())
          })
        })

        it("shows the card what everyone chose once the round begins", async () => {
          await withSetting("postRoundCard", true, async () => {
            await withSetting("blindDeclarations", true, async () => {
              const { combat, group } = await buildBlindCombat()
              await combat.startCombat()
              await waitFor(() => !!findRoundCard(combat), "a round card")

              await group.update({ initiative: 3 })

              await waitFor(
                () =>
                  findRoundCard(combat)
                    ?.system.units.flatMap((unit) => unit.members)
                    .concat(
                      findRoundCard(combat).system.segments.flatMap(
                        (s) => s.members,
                      ),
                    )
                    .some(
                      (member) =>
                        member.name === "Caster" &&
                        member.declarationLabel === CAST(),
                    ),
                "the card to reveal the spell",
              )
            })
          })
        })

        it("hides nothing when the table declares openly", async () => {
          await withSetting("blindDeclarations", false, async () => {
            const { combat } = await buildBlindCombat()

            assert.isFalse(combat.declarationsHidden)
            assert.equal(casterLine(combat).declarationLabel, CAST())
          })
        })
      })
    },
    { displayName: "BAGS: Declared Actions" },
  )
}
