/**
 * @file Integration tests for the monster sheet.
 *
 * The monster sheet shares its base class with the character sheet but shows a
 * different set of derived stats, so it needs its own rendering pass. What the
 * numbers on it should say is `./rules.test.mjs`' business, over in the character
 * folder -- these tests only care that the window comes up and reflects the Actor.
 */

import {
  cleanUpDocuments,
  createTestItem,
  createTestMonster,
  withRenderedApplication,
} from "../helpers.mjs"

/**
 * Register the monster sheet test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerMonsterViewTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.monster.view",
    (context) => {
      const { describe, it, assert, after } = context

      describe("The monster sheet", function monsterSheet() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("renders for a monster", async () => {
          const monster = await createTestMonster()

          await withRenderedApplication(monster.sheet, (sheet) => {
            assert.isTrue(sheet.rendered)
            assert.isOk(sheet.element.querySelector(".left-rail"))
          })
        })

        it("renders a monster with actions and items", async () => {
          const monster = await createTestMonster({ hp: 22 })
          await createTestItem({ type: "weapon", name: "Claws" }, monster)

          await withRenderedApplication(monster.sheet, (sheet) => {
            assert.isTrue(sheet.rendered)
            assert.strictEqual(sheet.title, monster.name)
          })
        })
      })
    },
    { displayName: "BAGS: Monster sheet" },
  )
}
