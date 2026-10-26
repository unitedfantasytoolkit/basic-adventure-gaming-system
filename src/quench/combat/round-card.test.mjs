/**
 * @file Integration tests for the round's chat card.
 *
 * The card is a record rather than a view: it keeps its own copy of the round so
 * that scrolling back shows what was true then, not what is true now. Most of
 * what is checked here follows from that -- that a new round clears last round's
 * intentions, and that an old card keeps them anyway.
 */

import {
  createTestCombat,
  cleanUpDocuments,
  createTestActor,
  trackDocument,
  waitFor,
  withSetting,
} from "../helpers.mjs"

/**
 * Register the round card test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerRoundCardTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.combat.round-card",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * A started encounter with one side of two.
       * @returns {Promise<object>} The combat, its group, and a lookup helper.
       */
      const buildCombat = async () => {
        const combat = await createTestCombat()
        // Owned outright by the current user, so the card still counts them as
        // an owner while it is viewed as a player. See `asPlayer`.
        const actor = await createTestActor({
          type: "monster",
          ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
        })
        const [group] = await combat.createEmbeddedDocuments("CombatantGroup", [
          { name: "Party", system: { side: "party" } },
        ])
        await combat.createEmbeddedDocuments("Combatant", [
          { actorId: actor.id, group: group.id, name: "Aldric" },
          { actorId: actor.id, group: group.id, name: "Vhast" },
        ])

        const named = (name) => combat.combatants.find((c) => c.name === name)
        return { combat, group, named }
      }

      /**
       * The most recent round card for a combat.
       * @param {Combat} combat - The encounter.
       * @param {number} [round] - Which round's card. Defaults to the current.
       * @returns {ChatMessage|undefined} The card.
       */
      const cardFor = (combat, round) =>
        game.messages.find(
          (m) =>
            m.type === "round" &&
            m.system?.combatId === combat.id &&
            m.system?.round === (round ?? combat.round),
        )

      /**
       * Every card a combat has produced, for counting duplicates.
       * @param {Combat} combat - The encounter.
       * @param {number} [round] - Which round's cards.
       * @returns {ChatMessage[]} All matching cards.
       */
      const allCardsFor = (combat, round) =>
        game.messages.filter(
          (m) =>
            m.type === "round" &&
            m.system?.combatId === combat.id &&
            (round === undefined || m.system?.round === round),
        )

      /**
       * Render something as a player would see it.
       *
       * The card invites players to declare and never the GM, and these tests
       * run as a GM. Overriding `isGM` on the current user for the length of a
       * render is the only way to see the player's side of the card from here.
       * Kept to a single render so nothing else runs while it is in place.
       * @param {Function} callback - The work to do.
       * @returns {Promise<any>} Whatever the callback returns.
       */
      const asPlayer = async (callback) => {
        Object.defineProperty(game.user, "isGM", {
          configurable: true,
          get: () => false,
        })
        try {
          return await callback()
        } finally {
          // The real `isGM` is a getter on the class, so removing the override
          // puts it back.
          delete game.user.isGM
        }
      }

      describe("Posting the card", function posting() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("posts one at the start of a round", async () => {
          const { combat } = await withSetting(
            "postRoundCard",
            true,
            async () => {
              const built = await buildCombat()
              await built.combat.startCombat()
              await waitFor(
                () => !!cardFor(built.combat),
                "a round card to be posted",
              )
              return built
            },
          )

          const card = cardFor(combat)
          assert.equal(card.system.round, 1)
          assert.equal(card.system.combatId, combat.id)
        })

        it("posts exactly one card per round", async () => {
          // Creating the card is a check-then-act: look for one, make one if
          // absent. The round hooks can fire twice in quick succession, and both
          // calls saw no card. Updates then landed on whichever the lookup
          // happened to return, so the visible card never changed.
          await withSetting("postRoundCard", true, async () => {
            const { combat } = await buildCombat()
            await combat.startCombat()
            await waitFor(() => !!cardFor(combat), "a round card")
            await new Promise((resolve) => {
              setTimeout(resolve, 500)
            })

            assert.lengthOf(allCardsFor(combat, 1), 1)
          })
        })

        it("records the turn order, grouped", async () => {
          await withSetting("postRoundCard", true, async () => {
            const { combat, group } = await buildCombat()
            await group.update({ initiative: 4 })
            await combat.startCombat()
            await waitFor(() => !!cardFor(combat), "a round card")

            const card = cardFor(combat)
            assert.lengthOf(card.system.units, 1, "one side, one block")
            assert.equal(card.system.units[0].name, "Party")
            assert.lengthOf(card.system.units[0].members, 2)
          })
        })

        it("posts nothing when the table has turned it off", async () => {
          await withSetting("postRoundCard", false, async () => {
            const { combat } = await buildCombat()
            await combat.startCombat()
            // Nothing to wait for, so give the round hooks room to not fire.
            await new Promise((resolve) => {
              setTimeout(resolve, 600)
            })
            assert.isUndefined(cardFor(combat))
          })
        })
      })

      describe("Declarations on the card", function declarations() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("follows a declaration as it is made", async () => {
          await withSetting("postRoundCard", true, async () => {
            await withSetting("declarationMode", "optional", async () => {
              const { combat, named } = await buildCombat()
              await combat.startCombat()
              await waitFor(() => !!cardFor(combat), "a round card")

              await named("Aldric").update({
                system: { declaration: { type: "bags.melee" } },
              })

              await waitFor(() => {
                const member = cardFor(combat)?.system.units[0].members.find(
                  (m) => m.name === "Aldric",
                )
                return !!member?.declarationLabel
              }, "the card to pick the declaration up")
            })
          })
        })

        it("clears last round's intentions when a new round opens", async () => {
          // A declaration belongs to the round it was made in. Left standing, a
          // character who said "I cast a spell" would go on paying for it.
          await withSetting("declarationMode", "optional", async () => {
            const { combat, named } = await buildCombat()
            await combat.startCombat()
            await named("Aldric").update({
              system: { declaration: { type: "bags.melee" } },
            })
            assert.equal(named("Aldric").declarationType.id, "bags.melee")

            await combat.nextRound()
            await waitFor(
              () => named("Aldric").declarationType.id === "bags.none",
              "declarations to be cleared for the new round",
            )
          })
        })

        it("keeps the old round's card intact after they are cleared", async () => {
          // The point of the card holding its own copy: history survives the
          // clearing that the next round performs.
          await withSetting("postRoundCard", true, async () => {
            await withSetting("declarationMode", "optional", async () => {
              const { combat, named } = await buildCombat()
              await combat.startCombat()
              await waitFor(() => !!cardFor(combat, 1), "round 1's card")

              await named("Aldric").update({
                system: { declaration: { type: "bags.melee" } },
              })
              await waitFor(() => {
                const m = cardFor(combat, 1)?.system.units[0].members.find(
                  (x) => x.name === "Aldric",
                )
                return !!m?.declarationLabel
              }, "round 1's card to record it")

              await combat.nextRound()
              await waitFor(() => !!cardFor(combat, 2), "round 2's card")

              const round1 = cardFor(combat, 1).system.units[0].members.find(
                (m) => m.name === "Aldric",
              )
              const round2 = cardFor(combat, 2).system.units[0].members.find(
                (m) => m.name === "Aldric",
              )

              assert.isNotEmpty(
                round1.declarationLabel,
                "round 1 should still remember what was declared",
              )
              assert.isEmpty(
                round2.declarationLabel,
                "round 2 starts with nothing declared",
              )
            })
          })
        })
      })

      describe("The segment ladder", function ladder() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        /**
         * An AD&D encounter: two sides, per-member offsets, segments.
         * @returns {Promise<object>} The combat and a lookup helper.
         */
        const buildSegmentCombat = async () => {
          const combat = trackDocument(
            await Combat.implementation.create({
              system: { initiativePreset: "advanced-1e" },
            }),
          )
          const actor = await createTestActor({ type: "monster" })
          await combat.createEmbeddedDocuments("CombatantGroup", [
            { name: "Party", system: { side: "party" } },
            { name: "Orcs", system: { side: "hostile" } },
          ])
          const party = combat.groups.find((g) => g.name === "Party")
          const orcs = combat.groups.find((g) => g.name === "Orcs")

          await combat.createEmbeddedDocuments("Combatant", [
            { actorId: actor.id, group: party.id, name: "Caster" },
            { actorId: actor.id, group: orcs.id, name: "Orc" },
          ])

          const named = (name) => combat.combatants.find((c) => c.name === name)
          return { combat, party, orcs, named }
        }

        it("captures as a ladder when members carry their own offsets", async () => {
          await withSetting("postRoundCard", true, async () => {
            const { combat } = await buildSegmentCombat()
            await combat.startCombat()
            await waitFor(() => !!cardFor(combat), "a round card")

            assert.equal(cardFor(combat).system.mode, "ladder")
            assert.lengthOf(cardFor(combat).system.units, 0, "no side blocks")
          })
        })

        it("holds the unrolled at the foot rather than inventing a segment", async () => {
          // Until a unit has rolled there is nothing to place its members by.
          //
          // Reached through `resetAll` rather than by inspecting a fresh combat:
          // these combatants have no player owner, so the declaration gating has
          // nobody to wait for and `startCombat` rolls straight away.
          await withSetting("postRoundCard", true, async () => {
            const { combat } = await buildSegmentCombat()
            await combat.startCombat()
            await waitFor(() => !!cardFor(combat), "a round card")

            await combat.resetAll()
            await waitFor(
              () => cardFor(combat)?.system.pending.length === 2,
              "both combatants to be waiting at the foot",
            )

            assert.lengthOf(cardFor(combat).system.segments, 0)
          })
        })

        it("interleaves the sides once everyone has rolled", async () => {
          await withSetting("postRoundCard", true, async () => {
            await withSetting("declarationMode", "optional", async () => {
              const { combat, party, orcs, named } = await buildSegmentCombat()
              await combat.startCombat()
              await waitFor(() => !!cardFor(combat), "a round card")

              // The party rolls better, then spends it: a casting time of 4
              // drops the caster behind orcs who rolled a segment later.
              await named("Caster").update({
                system: {
                  declaration: {
                    type: "bags.cast",
                    values: { castingTime: 4 },
                  },
                },
              })
              await party.update({ initiative: 2 })
              await orcs.update({ initiative: 3 })

              // Waiting on the *values*, not on a count. These combatants have
              // no player owner, so `startCombat` already rolled real dice for
              // both sides -- a wait for "two segments" is satisfied by those
              // random rolls before the fixed ones above have landed, and the
              // assertions then read whatever the dice happened to give.
              //
              // The caster's declaration has to have reached the card too. The
              // opening dice can give exactly 3 and 6 on their own -- the caster
              // on 3 with no spell yet, the orcs on 6 -- which passes a wait on
              // the numbers alone with the sides the wrong way round.
              await waitFor(() => {
                const segments = cardFor(combat)?.system.segments ?? []
                const placed = segments.map((s) => s.segment)
                const casting = segments
                  .flatMap((s) => s.members)
                  .some((m) => m.name === "Caster" && m.declarationLabel)
                return (
                  casting &&
                  placed.length === 2 &&
                  placed[0] === 3 &&
                  placed[1] === 6
                )
              }, "both sides placed at the segments their rolls and actions give")

              const card = cardFor(combat)
              // `deepEqual`, not `equal`: Quench runs on chai, where `equal` is
              // reference equality and silently fails on two matching arrays.
              assert.deepEqual(
                card.system.segments.map((s) => s.segment),
                [3, 6],
                "ascending, and the better roll acts later",
              )
              assert.equal(card.system.segments[0].members[0].name, "Orc")
              assert.equal(card.system.segments[1].members[0].name, "Caster")
              assert.lengthOf(card.system.pending, 0)
            })
          })
        })

        it("gives each row its own side colour", async () => {
          // There are no per-side blocks on a ladder, so the row is the only
          // thing that can say which side a combatant is on.
          await withSetting("postRoundCard", true, async () => {
            const { combat, party, orcs } = await buildSegmentCombat()
            await combat.startCombat()
            await waitFor(() => !!cardFor(combat), "a round card")
            await party.update({ initiative: 2 })
            await orcs.update({ initiative: 3 })

            await waitFor(() => {
              const placed = cardFor(combat)?.system.segments.map(
                (s) => s.segment,
              )
              return placed?.length === 2 && placed[0] === 2 && placed[1] === 3
            }, "both sides placed at their rolled segments")

            const sides = cardFor(combat)
              .system.segments.flatMap((s) => s.members)
              .map((m) => m.side)
            assert.include(sides, "party")
            assert.include(sides, "hostile")
          })
        })

        it("keeps an old card's layout when the ruleset changes", async () => {
          // The card branches on its *stored* mode. Re-resolving the rules at
          // render time would make a GM switching rulesets mid-campaign break
          // every card already in the log.
          await withSetting("postRoundCard", true, async () => {
            const combat = trackDocument(
              await Combat.implementation.create({
                system: { initiativePreset: "bx-group" },
              }),
            )
            const actor = await createTestActor({ type: "monster" })
            await combat.createEmbeddedDocuments("CombatantGroup", [
              { name: "Party", system: { side: "party" } },
            ])
            const group = combat.groups.contents[0]
            await combat.createEmbeddedDocuments("Combatant", [
              { actorId: actor.id, group: group.id, name: "Aldric" },
            ])
            await combat.startCombat()
            await waitFor(() => !!cardFor(combat), "a round card")

            const card = cardFor(combat)
            assert.equal(card.system.mode, "blocks")

            await combat.update({
              "system.initiativePreset": "advanced-1e",
            })

            const html = await card.renderHTML()
            assert.isOk(
              html.querySelector(".bags-round__unit"),
              "the old card still draws side blocks",
            )
            assert.isNull(
              html.querySelector(".bags-ladder"),
              "and does not try to draw a ladder it has no data for",
            )
          })
        })
      })

      describe("Rendering", function rendering() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("renders the round, the order, and an invitation for players", async () => {
          await withSetting("postRoundCard", true, async () => {
            await withSetting("declarationMode", "optional", async () => {
              const { combat, group } = await buildCombat()
              await group.update({ initiative: 4 })
              await combat.startCombat()
              await waitFor(() => !!cardFor(combat), "a round card")

              const html = await cardFor(combat).renderHTML()

              // The root has to be the `<li data-message-id>` the chat log
              // matches on when it re-renders a message. Without it every
              // update appends a fresh copy instead of replacing the old one.
              assert.isTrue(
                html.matches("li.chat-message"),
                "the root element should be the chat message wrapper",
              )
              assert.equal(
                html.dataset.messageId,
                cardFor(combat).id,
                "the wrapper must carry the message id",
              )
              assert.isOk(html.querySelector(".bags-round"), "card body")
              assert.include(
                html.querySelector(".bags-divider--round .bags-divider__label")
                  .textContent,
                "1",
                "the round's own rule should name the round",
              )
              assert.lengthOf(
                html.querySelectorAll(".action__attempt__result"),
                1,
                "each side gets a gem carrying its initiative",
              )
              assert.lengthOf(html.querySelectorAll(".bags-round__unit"), 1)
              assert.lengthOf(html.querySelectorAll(".bags-round__member"), 2)
              assert.lengthOf(
                html.querySelectorAll("[data-declare-combatant]"),
                0,
                "a GM owns every row, and would be invited for every monster",
              )

              const asSeenByPlayer = await asPlayer(() =>
                cardFor(combat).renderHTML(),
              )
              assert.isAbove(
                asSeenByPlayer.querySelectorAll("[data-declare-combatant]")
                  .length,
                0,
                "a player should be invited to declare for their own rows",
              )
            })
          })
        })

        it("offers no invitation once the round has passed", async () => {
          // A card scrolled back to is a record, not a prompt.
          await withSetting("postRoundCard", true, async () => {
            await withSetting("declarationMode", "optional", async () => {
              const { combat } = await buildCombat()
              await combat.startCombat()
              await waitFor(() => !!cardFor(combat, 1), "round 1's card")
              await combat.nextRound()
              await waitFor(() => !!cardFor(combat, 2), "round 2's card")

              const html = await asPlayer(() => cardFor(combat, 1).renderHTML())
              assert.lengthOf(
                html.querySelectorAll("[data-declare-combatant]"),
                0,
              )
            })
          })
        })
      })
    },
    { displayName: "BAGS: Round Card" },
  )
}
