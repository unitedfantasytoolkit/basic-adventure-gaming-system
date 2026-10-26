/**
 * @file Integration tests for the item editor every subtype inherits.
 *
 * `BAGSBaseItemEditor` is the window behind all of the per-type item editors:
 * weapon, armor, identity, class details and the plain item. Each subclass adds
 * its own tabs and templates, but they all save through the same handler, so the
 * contract is worth pinning down once here rather than in each of them.
 *
 * What a particular subtype's editor does with its own fields belongs in that
 * subtype's folder -- see `weapon/edit.test.mjs` and `armor/edit.test.mjs`.
 */

import {
  changeFormField,
  cleanUpDocuments,
  closeApplication,
  createTestClass,
  createTestItem,
  renderApplication,
  waitFor,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the item editor test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerItemEditorTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.applications.item-editor",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor } = editorTools(context)

      describe("Saving an edit", function saving() {
        this.timeout(30000)

        after(() => cleanUpDocuments())

        it("titles an editor after the document it edits", async () => {
          const item = await createTestItem({ type: "weapon", name: "Halberd" })

          await withEditor(item, "itemEditor", (editor) => {
            assert.include(editor.title, "Halberd")
            assert.include(
              editor.element.querySelector(".window-title").textContent,
              "Halberd",
            )
          })
        })

        it("edits an item's name and retitles its sheet", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })
          const { sheet } = item

          await renderApplication(sheet)

          try {
            await withEditor(item, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "name",
                "Longsword",
                () => item.name === "Longsword",
              )

              assert.strictEqual(item.name, "Longsword")
              await waitFor(
                () =>
                  sheet.element.querySelector(".window-title").textContent ===
                  "Longsword",
                "the sheet behind the editor to catch up",
              )
            })
          } finally {
            await closeApplication(sheet)
          }
        })

        it("edits a number on the item's system data", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })

          await withEditor(item, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.cost",
              "25",
              () => item.system.cost === 25,
            )

            assert.strictEqual(item.system.cost, 25)
          })
        })

        it("edits a checkbox on the item's system data", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })

          assert.isFalse(item.system.countsAsTreasure)

          await withEditor(item, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.countsAsTreasure",
              true,
              () => item.system.countsAsTreasure === true,
            )

            assert.isTrue(item.system.countsAsTreasure)
          })
        })

        it("opens an editor for every item type that has one", async () => {
          const types = Object.keys(CONFIG.Item.dataModels)

          // Sequential on purpose: each of these opens a window, and running
          // them together would put half a dozen on screen at once.
          await types.reduce(async (chain, type) => {
            await chain

            const item =
              type === "class"
                ? await createTestClass({ levels: 2 })
                : await createTestItem({ type, name: `A ${type}` })

            const editor = item.sheet.subApps.itemEditor
            if (!editor) return

            await renderApplication(editor)
            try {
              assert.isTrue(editor.rendered, `the ${type} editor should open`)
            } finally {
              await closeApplication(editor)
            }
          }, Promise.resolve())
        })
      })
    },
    { displayName: "BAGS: Item editor" },
  )
}
