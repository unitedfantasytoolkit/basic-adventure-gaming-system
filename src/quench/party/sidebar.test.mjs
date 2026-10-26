/**
 * @file Integration tests for the Party sidebar tab and the tab registration it
 * depends on.
 *
 * The registration is the fragile part, and it fails quietly. Foundry reads
 * `Sidebar.TABS` from the class rather than the instance when it works out which
 * render parts to build, so a tab configured in the wrong place produces a button
 * in the strip with nothing behind it -- no error, no warning, just a tab that
 * does nothing when clicked. That's how this tab was broken for a year, so the
 * wiring is tested here as carefully as the behaviour.
 */

import PartySidebar from "../../party/sidebar.mjs"
import RewardsSidebar from "../../rewards/sidebar.mjs"
import BAGSSidebar from "../../sidebar/sidebar.mjs"
import {
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
  createTestMonster,
  settle,
  waitFor,
  withEmptyParty,
} from "../helpers.mjs"

/**
 * Register the party sidebar test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerPartySidebarTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.party.sidebar",
    (context) => {
      const { describe, it, assert, after, afterEach } = context

      /**
       * Render the Party tab and wait for it to be on screen.
       *
       * The live `ui.party` is used rather than a fresh instance because a sidebar
       * tab claims a DOM id from its `tabName`, so a second copy would fight the
       * real one for the same element.
       * @returns {Promise<object>} The rendered Party tab
       */
      const renderPartyTab = async () => {
        await ui.party.render({ force: true })
        await waitFor(() => ui.party.element, "the party tab to render")
        return ui.party
      }

      /**
       * Find one character's row in the roster.
       *
       * Rows are looked up by Actor id rather than by position, because the world
       * this runs in may well have a real party in it -- so "the first row" is not
       * the row the test just created.
       * @param {object} tab - The rendered Party tab
       * @param {Actor} actor - The character whose row is wanted
       * @returns {HTMLElement|null} The row
       */
      const rowFor = (tab, actor) =>
        tab.element.querySelector(`.party-member[data-actor-id="${actor.id}"]`)

      describe("Sidebar tab registration", () => {
        it("installs the system's sidebar", () => {
          assert.strictEqual(CONFIG.ui.sidebar, BAGSSidebar)
          assert.instanceOf(ui.sidebar, BAGSSidebar)
        })

        it("registers the party and rewards tab applications", () => {
          assert.strictEqual(CONFIG.ui.party, PartySidebar)
          assert.strictEqual(CONFIG.ui.rewards, RewardsSidebar)
          assert.instanceOf(ui.party, PartySidebar)
          assert.instanceOf(ui.rewards, RewardsSidebar)
        })

        it("configures the tabs on the class, not the instance", () => {
          // The distinction that broke this tab before: Foundry reads
          // `this.constructor.TABS`, so an instance field of the same name is
          // read by nothing that matters.
          assert.property(
            BAGSSidebar.TABS,
            "party",
            "the party tab is missing from the class's tab configuration",
          )
          assert.property(BAGSSidebar.TABS, "rewards")
        })

        it("places the party tab after combat, and rewards after party", () => {
          // A party sits next to combat rather than next to the document
          // directories: like an encounter, it's a temporary grouping of actors,
          // not a type of document the world stores.
          const order = Object.keys(BAGSSidebar.TABS)

          assert.strictEqual(order[order.indexOf("combat") + 1], "party")
          assert.strictEqual(order[order.indexOf("party") + 1], "rewards")
        })

        it("keeps every tab Foundry ships", () => {
          const core = Object.keys(foundry.applications.sidebar.Sidebar.TABS)
          const ours = Object.keys(BAGSSidebar.TABS)

          core.forEach((tab) => {
            assert.include(ours, tab, `the ${tab} tab went missing`)
          })
        })

        it("leaves Foundry's own statics alone", () => {
          // Adding our tabs by mutating core's static would work until something
          // else rendered a plain Sidebar, so make sure we didn't.
          const { Sidebar } = foundry.applications.sidebar

          assert.notProperty(Sidebar.TABS, "party")
          assert.notProperty(Sidebar.TABS, "rewards")
          assert.notStrictEqual(BAGSSidebar.PARTS, Sidebar.PARTS)
        })

        it("keeps the rewards tab to the gamemaster", () => {
          assert.isTrue(BAGSSidebar.TABS.rewards.gmOnly)
        })

        it("gives each tab a name matching the key it is registered under", () => {
          // `AbstractSidebarTab` works out which tab is active by comparing
          // `tabName` against the sidebar's active tab, so a mismatch means a tab
          // that never reports itself as active.
          assert.strictEqual(PartySidebar.tabName, "party")
          assert.strictEqual(RewardsSidebar.tabName, "rewards")
        })

        it("builds a render part for each of the system's tabs", async () => {
          await renderPartyTab()

          assert.property(
            BAGSSidebar.PARTS,
            "party",
            "no render part was built for the party tab",
          )
        })
      })

      describe("Party membership", function partyMembership() {
        this.timeout(20000)

        afterEach(() => cleanUpDocuments())
        after(() => cleanUpDocuments())

        it("adds a character to the party", async () => {
          const character = await createTestCharacter()

          assert.isFalse(PartySidebar.isInParty(character))

          await PartySidebar.addToParty(character)

          assert.isTrue(PartySidebar.isInParty(character))
          assert.include(
            PartySidebar.members.map((member) => member.id),
            character.id,
          )
        })

        it("removes a character from the party", async () => {
          const character = await createTestCharacter()
          await PartySidebar.addToParty(character)

          await PartySidebar.removeFromParty(character)

          assert.isFalse(PartySidebar.isInParty(character))
          assert.notInclude(
            PartySidebar.members.map((member) => member.id),
            character.id,
          )
        })

        it("looks a character up by id as well as by document", async () => {
          const character = await createTestCharacter()

          assert.strictEqual(
            PartySidebar.lookupActor(character.id),
            character,
            "an id should resolve to the same Actor",
          )
          assert.strictEqual(PartySidebar.lookupActor(character), character)
        })

        it("refuses to treat a monster as a party member", async () => {
          const monster = await createTestMonster()

          assert.isNull(PartySidebar.lookupActor(monster))
          assert.isFalse(PartySidebar.isInParty(monster))

          // Asking to add one is a no-op rather than an error, because the drop
          // handler warns and stops before it ever gets here.
          await PartySidebar.addToParty(monster)

          assert.notInclude(
            PartySidebar.members.map((member) => member.id),
            monster.id,
          )
        })

        it("leaves no flag behind when a character is removed", async () => {
          const character = await createTestCharacter()
          await PartySidebar.addToParty(character)
          await PartySidebar.removeFromParty(character)

          assert.isUndefined(
            character.getFlag(game.system.id, "party"),
            "the flag should be unset, not set to false",
          )
        })
      })

      describe("The party roster", function partyRoster() {
        this.timeout(20000)

        afterEach(() => cleanUpDocuments())
        after(() => cleanUpDocuments())

        it("says so when the party is empty", () =>
          withEmptyParty(async () => {
            const tab = await renderPartyTab()

            assert.isOk(tab.element.querySelector(".party-empty"))
            assert.isNull(tab.element.querySelector(".party-member"))
          }))

        it("shows a row for each member, and nobody else", () =>
          withEmptyParty(async () => {
            const inParty = await createTestCharacter({
              data: { name: "[Quench] Alric" },
            })
            await createTestCharacter({ data: { name: "[Quench] Bystander" } })
            await PartySidebar.addToParty(inParty)

            const tab = await renderPartyTab()
            const rows = tab.element.querySelectorAll(".party-member")

            assert.lengthOf(rows, 1)
            assert.strictEqual(rows[0].dataset.actorId, inParty.id)
            assert.include(rows[0].textContent, "Alric")
          }))

        it("shows a member's hit points", async () => {
          const character = await createTestCharacter({
            data: { system: { hp: { value: 4, max: 9 } } },
          })
          await PartySidebar.addToParty(character)

          const tab = await renderPartyTab()
          const hp = rowFor(tab, character).querySelector(".member-hp")

          assert.isOk(hp, "the roster should show hit points")
          assert.strictEqual(Number(hp.dataset.hpValue), 4)
          assert.strictEqual(Number(hp.dataset.hpMax), 9)

          // The bar is filled by a custom property rather than a `<meter>`, so
          // that it themes with the rest of the sidebar.
          assert.closeTo(
            Number(hp.style.getPropertyValue("--hp-fraction")),
            4 / 9,
            0.001,
            "the bar should be filled to the fraction of HP remaining",
          )
        })

        it("marks a member who is hurt, and one who is down", async () => {
          const hurt = await createTestCharacter({
            data: {
              name: "[Quench] Hurt",
              system: { hp: { value: 2, max: 10 } },
            },
          })
          const down = await createTestCharacter({
            data: {
              name: "[Quench] Down",
              system: { hp: { value: 0, max: 10 } },
            },
          })
          await PartySidebar.addToParty(hurt)
          await PartySidebar.addToParty(down)

          const tab = await renderPartyTab()

          assert.isTrue(
            rowFor(tab, hurt).classList.contains("hurt"),
            "a character below half hit points should read as hurt",
          )
          assert.isTrue(
            rowFor(tab, down).classList.contains("dead"),
            "a character at zero hit points should read as down",
          )
        })

        it("shows a member's class and level", async () => {
          const character = await createTestCharacter()
          await PartySidebar.addToParty(character)
          await createTestClass({
            actor: character,
            level: 2,
            data: { name: "Fighter" },
          })

          const tab = await renderPartyTab()
          const row = rowFor(tab, character).querySelector(".member-class")

          assert.isOk(row, "a member with a class should show it")
          assert.include(row.textContent, "Fighter")
          assert.include(row.textContent, "2")
        })

        it("follows the Actors collection so member changes show up", async () => {
          const character = await createTestCharacter({
            data: { system: { hp: { value: 9, max: 9 } } },
          })
          await PartySidebar.addToParty(character)
          const tab = await renderPartyTab()

          // Joining `game.actors.apps` is what gets a sidebar tab re-rendered on
          // an Actor change. Without it the roster silently goes stale.
          assert.include(game.actors.apps, tab)

          await character.update({ "system.hp.value": 2 })
          await settle()

          assert.strictEqual(
            Number(
              rowFor(tab, character).querySelector(".member-hp").dataset
                .hpValue,
            ),
            2,
            "the roster should show the new hit point total",
          )
        })

        it("refreshes when a member's items change", async () => {
          const character = await createTestCharacter()
          await PartySidebar.addToParty(character)
          const tab = await renderPartyTab()

          // Encumbrance and armor class come from items, and an embedded change
          // never reaches the Actors collection -- hence the extra Item hooks.
          const encumbranceShown = () =>
            rowFor(tab, character).querySelector(
              '[data-stat="encumbrance"] .value',
            ).textContent

          const before = encumbranceShown()

          await createTestItem(
            {
              name: "Heavy Loot",
              type: "item",
              system: { weight: 100, quantity: 1, countsAsTreasure: true },
            },
            character,
          )
          await settle()

          assert.notStrictEqual(
            encumbranceShown(),
            before,
            "adding treasure should change the encumbrance shown",
          )
        })
      })

      describe("The party header", function partyHeader() {
        this.timeout(20000)

        afterEach(() => cleanUpDocuments())
        after(() => cleanUpDocuments())

        it("counts the party", () =>
          withEmptyParty(async () => {
            const character = await createTestCharacter()
            await PartySidebar.addToParty(character)

            const tab = await renderPartyTab()

            assert.include(
              tab.element.querySelector(".party-title").textContent,
              "1",
            )
          }))

        it("reports the rate of the slowest member", () =>
          withEmptyParty(async () => {
            // A party travels no faster than whoever is slowest, so that -- not an
            // average, and not the fastest -- is the number the header shows.
            const quick = await createTestCharacter({
              data: { name: "[Quench] Quick" },
            })
            const slow = await createTestCharacter({
              data: { name: "[Quench] Slow" },
            })
            await PartySidebar.addToParty(quick)
            await PartySidebar.addToParty(slow)

            // Treasure is what slows a character down in B/X.
            await createTestItem(
              {
                name: "Millstone",
                type: "item",
                system: { weight: 400, quantity: 1, countsAsTreasure: true },
              },
              slow,
            )
            await settle()

            const tab = await renderPartyTab()
            const rate = tab.element.querySelector(".marching-rate .value")
            const speeds = [quick, slow].map(
              (actor) => actor.system.speed.exploration,
            )

            assert.isOk(rate, "the header should show a marching rate")
            assert.strictEqual(
              Number(rate.textContent),
              Math.min(...speeds),
              "the rate shown should be the slowest member's",
            )
          }))

        it("offers only characters who are not already in the party", async () => {
          const inParty = await createTestCharacter({
            data: { name: "[Quench] Joined" },
          })
          const outside = await createTestCharacter({
            data: { name: "[Quench] Available" },
          })
          await PartySidebar.addToParty(inParty)

          const candidateIds = PartySidebar.candidates.map((actor) => actor.id)

          assert.include(candidateIds, outside.id)
          assert.notInclude(
            candidateIds,
            inParty.id,
            "someone already in the party should not be offered again",
          )
        })
      })
    },
    { displayName: "BAGS: Party sidebar" },
  )
}
