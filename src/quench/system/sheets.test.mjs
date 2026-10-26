/**
 * @file A rendering smoke test for every sheet the system registers.
 *
 * One test per registered Item subtype, generated from `CONFIG.Item.dataModels`
 * rather than hardcoded -- so a new item type is covered the moment it's
 * registered, and fails here if nobody gave it a sheet that works.
 *
 * This is deliberately shallow. What a particular sheet shows, and what its
 * editors write back, belongs in that subtype's own folder; all this asks is
 * whether the window opens at all. The Actor sheets are covered the same way but
 * in more depth, in `character/view.test.mjs` and `monster/view.test.mjs`, because
 * there are only two of them and both have plenty to say.
 */

import {
  cleanUpDocuments,
  createTestClass,
  createTestItem,
  withRenderedApplication,
} from "../helpers.mjs"

/**
 * Every Item type the system registers a sheet for.
 * @returns {string[]} Item subtype names
 */
const itemTypes = () => Object.keys(CONFIG.Item.dataModels)

/**
 * Register the sheet rendering test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSheetRenderingTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.system.sheets",
    (context) => {
      const { describe, it, assert, after } = context

      describe("Item sheets", function itemSheets() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        // One test per registered type, so a failure names the type that broke
        // rather than stopping at the first one.
        itemTypes().forEach((type) => {
          it(`renders the ${type} sheet`, async () => {
            const item =
              type === "class"
                ? await createTestClass({ levels: 3, level: 1 })
                : await createTestItem({ type, name: `A ${type}` })

            await withRenderedApplication(item.sheet, (sheet) => {
              assert.isTrue(sheet.rendered)
              assert.strictEqual(
                sheet.element.querySelector(".window-title").textContent,
                item.name,
              )
            })
          })
        })
      })
    },
    { displayName: "BAGS: Sheet rendering" },
  )
}
