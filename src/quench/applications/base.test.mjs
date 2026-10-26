/**
 * @file Integration tests for the application base class.
 *
 * `BAGSApplication` is what every sheet and editor in the system is built on, and
 * the contract these tests pin down is the one everything else quietly relies on:
 * that `render()` and `close()` resolve when they say they do, and that closing a
 * window takes its sub-applications with it.
 *
 * It matters more than it sounds. A `render()` that resolves early means anything
 * acting on the window afterwards is racing it, and a `close()` that resolves
 * early means `_onClose` may not have run -- which is where the character creation
 * flow releases the sheet it was holding shut.
 */

import {
  cleanUpDocuments,
  closeApplication,
  createTestCharacter,
  renderApplication,
  waitFor,
} from "../helpers.mjs"

/**
 * Register the application base class test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerApplicationTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.applications.base",
    (context) => {
      const { describe, it, assert, after } = context

      describe("Rendering and closing", function lifecycle() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("closes its sub-applications along with itself", async () => {
          const actor = await createTestCharacter()
          const { sheet } = actor

          await renderApplication(sheet)
          await renderApplication(sheet.subApps.actorEditor)

          await sheet.close({ animate: false })
          await waitFor(
            () => !sheet.subApps.actorEditor.rendered,
            "the editor to close with its sheet",
          )

          assert.isFalse(
            sheet.subApps.actorEditor.rendered,
            "closing a sheet should not leave its editors behind",
          )
        })

        it("resolves render() only once the window is on screen", async () => {
          // `BAGSApplication#render` has to return what `super.render()` gives
          // it. Without that, the promise a caller awaits says "I have started",
          // not "I am done", and anything that renders a sub-application and then
          // acts on it is racing the render -- including `close()`, which no-ops
          // on an application that hasn't got an element yet.
          const actor = await createTestCharacter()
          const editor = actor.sheet.subApps.actorEditor

          try {
            await editor.render(true)

            assert.isTrue(
              editor.rendered,
              "awaiting render() should mean the window is up",
            )
          } finally {
            await closeApplication(editor)
          }
        })

        it("resolves close() only once the window is gone", async () => {
          // The other half of the same problem: `close()` has to pass its options
          // on and await the result. A window animates out over as much as a
          // second, and `_onClose` -- where the character creation flow releases
          // the sheet it was holding shut -- doesn't run until that's finished.
          const actor = await createTestCharacter()
          const editor = actor.sheet.subApps.actorEditor

          await renderApplication(editor)
          await editor.close({ animate: false })

          assert.isFalse(
            editor.rendered,
            "awaiting close() should mean the window is gone",
          )
          assert.isNull(
            editor.element,
            "and that its element has been torn down",
          )
        })
      })
    },
    { displayName: "BAGS: Application base class" },
  )
}
