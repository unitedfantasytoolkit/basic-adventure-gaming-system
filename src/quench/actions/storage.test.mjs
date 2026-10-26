/**
 * @file Integration tests for storing actions on a document.
 *
 * Actions live in an ArrayField of deep schema objects, and `BAGSItem` wraps that
 * array in four methods -- create, get, update, delete -- that every part of the
 * system goes through. They're worth testing against a real document rather than a
 * plain array, because each one writes through Foundry's schema cleaning on the way
 * in, and that's where a malformed action would be silently reshaped.
 *
 * The editor that calls these is `applications/action-editor.test.mjs`; resolving
 * what they store is `./resolution.test.mjs`.
 */

import {
  captureRejection,
  cleanUpDocuments,
  createTestItem,
} from "../helpers.mjs"

/**
 * Register the action storage test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerActionStorageTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.actions.storage",
    (context) => {
      const { describe, it, assert, after } = context

      describe("Adding, changing and removing", function crud() {
        this.timeout(10000)

        after(() => cleanUpDocuments())

        it("adds, updates and deletes an action", async () => {
          const item = await createTestItem({ type: "item" })

          await item.createAction()
          assert.lengthOf(item.system.actions, 1)

          const [action] = item.system.actions
          assert.isNotEmpty(action.id, "a new action needs an id")

          await item.updateAction(action.id, { name: "Renamed" })
          assert.strictEqual(item.getAction(action.id).name, "Renamed")

          await item.deleteAction(action.id)
          assert.lengthOf(item.system.actions, 0)
        })

        it("refuses to update an action that isn't there", async () => {
          const item = await createTestItem({ type: "item" })

          const error = await captureRejection(() =>
            item.updateAction("nope", { name: "Renamed" }),
          )

          assert.isOk(error, "updating a missing action should have thrown")
          assert.match(error.message, /action not found/)
        })
      })
    },
    { displayName: "BAGS: Action storage" },
  )
}
