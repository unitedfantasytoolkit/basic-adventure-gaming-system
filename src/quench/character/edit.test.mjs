/**
 * @file Integration tests for editing a character.
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
  closeApplication,
  createTestCharacter,
  renderApplication,
  waitFor,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the character editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerCharacterEditTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.edit",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor, invokeAction } = editorTools(context)

      describe("Opening the editor from the sheet", function opening() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("opens the character editor from a character sheet", async () => {
          const actor = await createTestCharacter()
          const { sheet } = actor

          await renderApplication(sheet)

          try {
            await invokeAction(sheet, "edit-actor")

            await waitFor(
              () => sheet.subApps.actorEditor.rendered,
              "the character editor to open",
            )
          } finally {
            await closeApplication(sheet.subApps.actorEditor)
            await closeApplication(sheet)
          }
        })
      })

      describe("Editing a character", function editing() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("edits a character's ability score", async () => {
          const actor = await createTestCharacter()

          await withEditor(actor, "actorEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.base.abilityScores.str",
              "16",
              () => actor.system.base.abilityScores.str === 16,
            )

            assert.strictEqual(actor.system.base.abilityScores.str, 16)
            assert.strictEqual(
              actor.system.abilityScores.str.meleeAttack,
              2,
              "the derived modifier should follow the edited score",
            )
          })
        })

        it("edits a character's maximum hit points", async () => {
          const actor = await createTestCharacter()

          await withEditor(actor, "actorEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.hp.max",
              "12",
              () => actor.system.hp.max === 12,
            )

            assert.strictEqual(actor.system.hp.max, 12)
          })
        })
      })
    },
    { displayName: "BAGS: Character editing" },
  )
}
