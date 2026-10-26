/**
 * @file Integration tests for the class advancement editor.
 *
 * Sheets are mostly read-only: they show a document. The editors are where a
 * document is actually changed, and they're the least testable code in the system
 * by any other means -- Foundry calls a static handler with `this` bound to the
 * application, the handler reads the DOM event, mutates the document and
 * re-renders, and none of that can be reached without a real window, a real
 * document and a real click.
 *
 * The fixtures that drive an editor -- `withEditor`, `click`, `invokeAction` and
 * `dropOnto` -- are shared, and live in `../editor-tools.mjs`.
 *
 * A character class is the most structured document in the system: an XP table
 * with one row per level, a grid of spell slots, and pools of resources that grow
 * as the class does. The editor adds and removes rows and columns in all three,
 * which is the kind of thing that breaks quietly.
 */

import {
  answerDialog,
  changeFormField,
  cleanUpDocuments,
  createTestClass,
  renderApplication,
  waitFor,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the class advancement editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerClassAdvancementTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.class.advancement",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor, click } = editorTools(context)

      describe("The class XP table editor", function xpTableEditor() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        it("adds a level by copying the last one", async () => {
          const cls = await createTestClass({ levels: 2 })
          const lastRow = cls.system.xpTable[1]

          await withEditor(cls, "advancementEditor", async (editor) => {
            click(editor, '[data-action="add-level"]')

            await waitFor(
              () => cls.system.xpTable.length === 3,
              "the new level to be added",
            )

            assert.strictEqual(cls.system.xpTable[2].value, lastRow.value)
            assert.strictEqual(cls.system.xpTable[2].thac0, lastRow.thac0)
          })
        })

        it("removes the last level", async () => {
          const cls = await createTestClass({ levels: 3 })
          const firstRow = cls.system.xpTable[0]

          await withEditor(cls, "advancementEditor", async (editor) => {
            click(editor, '[data-action="remove-level"]')

            await waitFor(
              () => cls.system.xpTable.length === 2,
              "the last level to be removed",
            )

            assert.strictEqual(
              cls.system.xpTable[0].value,
              firstRow.value,
              "removing the last row should not disturb the first",
            )
          })
        })

        it("adds a spell level", async () => {
          const cls = await createTestClass({ levels: 2, spellSlots: [[1, 2]] })

          await withEditor(cls, "advancementEditor", async (editor) => {
            click(editor, '[data-action="add-spell-level"]')

            await waitFor(
              () => cls.system.spellSlots.length === 2,
              "the spell level to be added",
            )
          })
        })

        it("removes a spell level once confirmed", async () => {
          const cls = await createTestClass({
            levels: 2,
            spellSlots: [
              [1, 2],
              [0, 1],
            ],
          })

          await withEditor(cls, "advancementEditor", async (editor) => {
            click(editor, '[data-action="remove-spell-level"]')
            await answerDialog(true)

            await waitFor(
              () => cls.system.spellSlots.length === 1,
              "the spell level to be removed",
            )
          })
        })

        it("adds a leveled resource category and a pool inside it", async () => {
          const cls = await createTestClass({ levels: 2 })

          await withEditor(cls, "advancementEditor", async (editor) => {
            click(editor, '[data-action="add-resource"]')

            await waitFor(
              () => cls.system.leveledResources.length === 1,
              "the resource category to be added",
            )

            await renderApplication(editor)

            click(editor, '[data-action="add-resource-pool"]')

            await waitFor(
              () => cls.system.leveledResources[0].pool.length === 1,
              "the resource pool to be added",
            )
          })
        })

        it("saves an edited XP threshold", async () => {
          const cls = await createTestClass({ levels: 2 })

          await withEditor(cls, "advancementEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.xpTable.1.value",
              "2500",
              () => cls.system.xpTable[1].value === 2500,
            )

            assert.strictEqual(cls.system.xpTable[1].value, 2500)
          })
        })
      })
    },
    { displayName: "BAGS: Class advancement editing" },
  )
}
