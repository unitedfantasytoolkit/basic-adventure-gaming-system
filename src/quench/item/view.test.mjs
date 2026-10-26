/**
 * @file Integration tests for the plain `item` subtype's sheet.
 *
 * This is the miscellaneous item -- gear, treasure, and anything that can be a
 * container. Being a container is the one thing its sheet does that no other
 * sheet does, so it's the one thing worth asserting on here. That every sheet in
 * the system renders at all is `system/sheets.test.mjs`.
 */

import {
  cleanUpDocuments,
  createTestCharacter,
  createTestItem,
  withRenderedApplication,
} from "../helpers.mjs"

/**
 * Register the item sheet test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerItemViewTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.item.view",
    (context) => {
      const { describe, it, assert, after } = context

      describe("The item sheet", function itemSheet() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("renders a container's contents", async () => {
          const actor = await createTestCharacter()
          const bag = await createTestItem(
            {
              type: "item",
              name: "Backpack",
              system: {
                container: { isContainer: true, weightMax: 400 },
              },
            },
            actor,
          )
          const rope = await createTestItem(
            { type: "item", name: "Rope", system: { weight: 50 } },
            actor,
          )

          await rope.addToContainer(bag)

          await withRenderedApplication(bag.sheet, (sheet) => {
            assert.isOk(
              sheet.element.querySelector(".container-contents"),
              "a container should show a contents pane",
            )
            assert.lengthOf(
              sheet.element.querySelectorAll(
                ".item-grid--container uft-item-tile",
              ),
              1,
            )
            assert.strictEqual(
              sheet.element.querySelector(".capacity-max").textContent.trim(),
              "400",
            )
          })
        })

        it("leaves the contents pane off an ordinary item", async () => {
          const item = await createTestItem({ type: "item", name: "Torch" })

          await withRenderedApplication(item.sheet, (sheet) => {
            assert.isNull(sheet.element.querySelector(".container-contents"))
          })
        })
      })
    },
    { displayName: "BAGS: Item sheet" },
  )
}
