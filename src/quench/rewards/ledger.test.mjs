/**
 * @file Integration tests for the rewards ledger and the tab that shows it.
 *
 * The arithmetic that divides a reward is unit tested in `test/rewards-ledger.test.mjs`.
 * What's tested here is everything that needs a running world: that the ledger
 * survives a round trip through its world setting, that a reward aimed at "the
 * whole party" is resolved against the roster as it stands when it's handed out,
 * and that a character with nowhere to put experience is reported rather than
 * quietly skipped.
 */

import PartySidebar from "../../party/sidebar.mjs"
import { previewAwards } from "../../rewards/award.mjs"
import {
  addEntry,
  clearLedger,
  getEntries,
  removeEntry,
  updateEntry,
} from "../../rewards/ledger.mjs"
import {
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  waitFor,
  withEmptyLedger,
  withEmptyParty,
} from "../helpers.mjs"

/**
 * Register the rewards ledger test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerRewardsTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.rewards.ledger",
    (context) => {
      const { describe, it, assert, after, afterEach } = context

      describe("The rewards ledger", function rewardsLedger() {
        this.timeout(20000)

        /**
         * Render the Rewards tab and wait for it to be on screen.
         * @returns {Promise<object>} The rendered Rewards tab
         */
        const renderRewardsTab = async () => {
          await ui.rewards.render({ force: true })
          await waitFor(() => ui.rewards.element, "the rewards tab to render")
          return ui.rewards
        }

        /**
         * Record a reward for a test.
         * @param {object} overrides - Fields to override on the entry
         * @returns {Promise<object>} The stored entry
         */
        const record = (overrides = {}) =>
          addEntry({
            kind: "treasure",
            label: "[Quench] Hoard",
            xp: 1000,
            recipients: "all",
            split: true,
            ...overrides,
          })

        /**
         * Run a test against an empty ledger and an empty party, then put both
         * back.
         *
         * Both are world state that outlives a test run: the referee's real party,
         * and rewards they have earned but not handed out. Neither can simply be
         * cleared -- that would throw away their unawarded experience -- and
         * neither can be assumed empty, because a reward aimed at "the whole
         * party" divides by however many members there actually are.
         * @param {() => Promise<void>} callback - The test body
         * @returns {Promise<void>} Resolves once the world has been restored
         */
        const inCleanWorld = (callback) =>
          withEmptyLedger(() => withEmptyParty(callback))

        afterEach(() => cleanUpDocuments())
        after(() => cleanUpDocuments())

        it("says so when nothing is waiting to be handed out", () =>
          inCleanWorld(async () => {
            const tab = await renderRewardsTab()

            assert.isOk(tab.element.querySelector(".rewards-empty"))
            assert.isNull(tab.element.querySelector(".reward-entry"))
          }))

        it("records a reward, and gives it an id of its own", () =>
          inCleanWorld(async () => {
            const stored = await record()

            assert.isString(stored.id)
            assert.deepEqual(
              getEntries().map((entry) => entry.id),
              [stored.id],
            )
          }))

        it("changes one reward without disturbing the others", () =>
          inCleanWorld(async () => {
            const first = await record({ label: "[Quench] First" })
            const second = await record({ label: "[Quench] Second" })

            await updateEntry(second.id, { xp: 42 })
            const entries = getEntries()

            assert.strictEqual(
              entries.find((entry) => entry.id === second.id).xp,
              42,
            )
            assert.strictEqual(
              entries.find((entry) => entry.id === first.id).xp,
              1000,
              "the other entry should be untouched",
            )
          }))

        it("removes a reward", () =>
          inCleanWorld(async () => {
            const first = await record({ label: "[Quench] First" })
            const second = await record({ label: "[Quench] Second" })

            await removeEntry(first.id)

            assert.deepEqual(
              getEntries().map((entry) => entry.id),
              [second.id],
            )
          }))

        it("shows a row for each reward, and the button that hands them out", () =>
          inCleanWorld(async () => {
            const character = await createTestCharacter()
            await PartySidebar.addToParty(character)
            await createTestClass({ actor: character })
            await record()

            const tab = await renderRewardsTab()
            const rows = tab.element.querySelectorAll(".reward-entry")

            assert.lengthOf(rows, 1)
            assert.include(rows[0].textContent, "Hoard")
            assert.isNotNull(
              tab.element.querySelector('[data-action="awardAll"]'),
              "there should be a way to hand the ledger out",
            )
          }))

        it("resolves a whole-party reward against the roster as it stands", () =>
          inCleanWorld(async () => {
            // The point of storing "all" instead of a list of ids: somebody who joins
            // after the reward is recorded still gets a share of it.
            const first = await createTestCharacter({
              data: { name: "[Quench] Early" },
            })
            await PartySidebar.addToParty(first)
            await createTestClass({ actor: first })
            await record({ xp: 1000 })

            const latecomer = await createTestCharacter({
              data: { name: "[Quench] Late" },
            })
            await PartySidebar.addToParty(latecomer)
            await createTestClass({ actor: latecomer })

            const { awards } = previewAwards()

            assert.lengthOf(
              awards,
              2,
              "both characters should share the reward",
            )
            assert.deepEqual(
              awards.map((award) => award.total),
              [500, 500],
            )
          }))

        it("holds back a character with no class to record experience on", () =>
          inCleanWorld(async () => {
            const classed = await createTestCharacter({
              data: { name: "[Quench] Classed" },
            })
            const unclassed = await createTestCharacter({
              data: { name: "[Quench] Unclassed" },
            })
            await PartySidebar.addToParty(classed)
            await PartySidebar.addToParty(unclassed)
            await createTestClass({ actor: classed })
            await record({ xp: 1000 })

            const preview = previewAwards()

            assert.deepEqual(
              preview.awards.map((award) => award.id),
              [classed.id],
              "only a character with a class can be awarded",
            )
            assert.deepEqual(
              preview.unclassed.map((actor) => actor.id),
              [unclassed.id],
              "the character who cannot be awarded should be reported",
            )
          }))

        it("empties the ledger", () =>
          inCleanWorld(async () => {
            await record()
            await clearLedger()

            assert.isEmpty(getEntries())
          }))
      })
    },
    { displayName: "BAGS: Rewards ledger" },
  )
}
