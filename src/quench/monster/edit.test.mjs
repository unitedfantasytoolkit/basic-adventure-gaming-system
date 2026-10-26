/**
 * @file Integration tests for editing a monster.
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
 */

import {
  changeFormField,
  cleanUpDocuments,
  createTestMonster,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the monster editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerMonsterEditTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.monster.edit",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor } = editorTools(context)

      describe("Editing a monster", function editing() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("edits a monster", async () => {
          const monster = await createTestMonster({ hp: 8 })

          await withEditor(monster, "actorEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.hp.max",
              "20",
              () => monster.system.hp.max === 20,
            )

            assert.strictEqual(monster.system.hp.max, 20)
          })
        })
      })
    },
    { displayName: "BAGS: Monster editing" },
  )
}
