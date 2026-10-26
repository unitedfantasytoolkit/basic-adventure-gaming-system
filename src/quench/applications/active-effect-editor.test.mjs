/**
 * @file Integration tests for the Active Effect editor.
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
  answerDialog,
  cleanUpDocuments,
  createTestItem,
  renderApplication,
  waitFor,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the active effect editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerActiveEffectEditorTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.applications.active-effect-editor",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor, click } = editorTools(context)

      describe("The Active Effect editor", function activeEffects() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("adds an Active Effect to an item", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })

          await withEditor(item, "activeEffectEditor", async (editor) => {
            click(editor, '[data-action="add-active-effect"]')

            await waitFor(() => item.effects.size === 1, "the effect to appear")

            const [effect] = Array.from(item.effects)
            assert.isNotEmpty(effect.name, "a new effect needs a name")
          })
        })

        it("lists the effects already on the document", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })
          const [effect] = await item.createEmbeddedDocuments("ActiveEffect", [
            { name: "Flaming" },
          ])

          await withEditor(item, "activeEffectEditor", (editor) => {
            assert.isOk(
              editor.element.querySelector(`[data-effect-id="${effect.id}"]`),
              "an existing effect should be listed",
            )
          })
        })

        it("toggles an effect off and on again", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })
          const [effect] = await item.createEmbeddedDocuments("ActiveEffect", [
            { name: "Flaming" },
          ])

          await withEditor(item, "activeEffectEditor", async (editor) => {
            assert.isFalse(effect.disabled)

            // The effect's ID is on the card; the buttons sit inside it.
            click(
              editor,
              `[data-effect-id="${effect.id}"] [data-action="toggle-active-effect"]`,
            )
            await waitFor(() => effect.disabled, "the effect to be disabled")

            await renderApplication(editor)

            click(
              editor,
              `[data-effect-id="${effect.id}"] [data-action="toggle-active-effect"]`,
            )
            await waitFor(() => !effect.disabled, "the effect to be re-enabled")
          })
        })

        it("deletes an effect once confirmed", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })
          const [effect] = await item.createEmbeddedDocuments("ActiveEffect", [
            { name: "Flaming" },
          ])

          await withEditor(item, "activeEffectEditor", async (editor) => {
            click(
              editor,
              `[data-effect-id="${effect.id}"] [data-action="delete-active-effect"]`,
            )
            await answerDialog(true)

            await waitFor(
              () => item.effects.size === 0,
              "the effect to be deleted",
            )
          })
        })
      })
    },
    { displayName: "BAGS: Active Effect editing" },
  )
}
