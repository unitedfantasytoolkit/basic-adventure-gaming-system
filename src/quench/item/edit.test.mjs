/**
 * @file Integration tests for editing a plain `item`.
 *
 * The miscellaneous item's editor is the base editor plus the container fields,
 * and turning an ordinary item into a container is the interesting thing it does:
 * it changes what the sheet shows and what the inventory rules will allow. The
 * base editor's own contract is `applications/item-editor.test.mjs`.
 */

import {
  changeFormField,
  cleanUpDocuments,
  createTestItem,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the item editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerItemEditTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.item.edit",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor } = editorTools(context)

      describe("Editing an item", function editing() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("turns an ordinary item into a container", async () => {
          const item = await createTestItem({ type: "item", name: "Sack" })

          await withEditor(item, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.container.isContainer",
              true,
              () => item.system.container.isContainer === true,
            )

            assert.isTrue(item.system.container.isContainer)
          })
        })
      })
    },
    { displayName: "BAGS: Item editing" },
  )
}
