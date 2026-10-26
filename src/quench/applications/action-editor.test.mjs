/**
 * @file Integration tests for the action and effect editors.
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
 * Actions get more attention here than anything else, because they're the most
 * intricate thing the system stores: an array of deep schema objects, each with
 * its own array of effects, each of which can carry an Active Effect's worth of
 * changes. There's no way to be confident about editing that by inspection.
 *
 * Where a handler waits on a confirmation dialog, these tests click the real
 * button and then answer the real dialog. Where a handler is driven by drag and
 * drop, they dispatch a real DragEvent carrying a real DataTransfer, so the drop
 * lands through the same binding a player's drag would.
 */

import {
  answerDialog,
  buildActionEffect,
  changeFormField,
  cleanUpDocuments,
  closeApplication,
  createTestItem,
  renderApplication,
  waitFor,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the action and effect editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerActionEditorTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.applications.action-editor",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor, click, dropOnto } = editorTools(context)

      // === Local fixtures ====================================================

      /**
       * Select an action in the editor's list, the way a user would.
       *
       * The editor picks its selection in its constructor -- which runs when the
       * sheet is built, long before a test has created any actions -- so a test
       * that wants a particular action in the detail pane has to click its row.
       * That matters beyond tidiness: the effect handlers read
       * `this._activeAction` with no fallback, so nothing works until something
       * has been selected.
       * @param {object} editor - The rendered action editor
       * @param {string} actionId - The action to select
       * @returns {Promise<void>} Resolves once the detail pane has caught up
       */
      const selectAction = async (editor, actionId) => {
        click(
          editor,
          `[data-action-id="${actionId}"] [data-action="select-action"]`,
        )

        await waitFor(
          () => editor._activeAction === actionId,
          "the action to be selected",
        )

        // The handler re-renders without awaiting it, so render again to be sure
        // the detail pane on screen is the one being asserted about.
        await renderApplication(editor)
      }

      /**
       * An Item with two named actions on it, ready to be rearranged.
       * @returns {Promise<Item>} The Item
       */
      const createItemWithActions = async () => {
        const item = await createTestItem({ type: "item", name: "Wand" })

        await item.createAction()
        await item.createAction()

        const [first, second] = item.system.actions

        await item.updateAction(first.id, { name: "First" })
        await item.updateAction(second.id, { name: "Second" })

        return item
      }

      /**
       * The action on an Item with a given name.
       * @param {Item} item - The Item to look on
       * @param {string} name - The action's name
       * @returns {object|undefined} The action
       */
      const actionNamed = (item, name) =>
        item.system.actions.find((action) => action.name === name)

      // === The action editor =================================================

      describe("The action editor", function actionEditor() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        it("lists every action on the item", async () => {
          const item = await createItemWithActions()

          await withEditor(item, "actionEditor", (editor) => {
            const rows = editor.element.querySelectorAll(
              ".application__master-detail__master-item",
            )

            assert.lengthOf(rows, 2)
            assert.deepEqual(
              Array.from(rows).map((row) => row.dataset.actionId),
              item.system.actions.map((action) => action.id),
            )
          })
        })

        it("adds an action", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })

          await withEditor(item, "actionEditor", async (editor) => {
            click(editor, '[data-action="add-action"]')

            await waitFor(
              () => item.system.actions.length === 1,
              "the new action to be created",
            )

            assert.strictEqual(
              editor._activeAction,
              item.system.actions[0].id,
              "the first action added should become the selected one",
            )
          })
        })

        it("gives each added action its own name", async () => {
          // The editor works out a unique name ("New Action", "New Action 2")
          // and hands it to `BAGSItem#createAction`, which has to actually use
          // it -- otherwise every action on an item is called "New Action" and
          // there's no way to tell one row from the next.
          const item = await createTestItem({ type: "item", name: "Wand" })

          await withEditor(item, "actionEditor", async (editor) => {
            click(editor, '[data-action="add-action"]')
            await waitFor(
              () => item.system.actions.length === 1,
              "the first action",
            )

            click(editor, '[data-action="add-action"]')
            await waitFor(
              () => item.system.actions.length === 2,
              "the second action",
            )

            const [first, second] = item.system.actions

            assert.notStrictEqual(
              first.name,
              second.name,
              "two actions with the same name can't be told apart",
            )
          })
        })

        it("selects an action when its row is clicked", async () => {
          const item = await createItemWithActions()
          const second = actionNamed(item, "Second")

          await withEditor(item, "actionEditor", async (editor) => {
            click(
              editor,
              `[data-action-id="${second.id}"] [data-action="select-action"]`,
            )

            await waitFor(
              () => editor._activeAction === second.id,
              "the second action to be selected",
            )

            // The handler re-renders without awaiting it, so the pane on screen
            // is still the old one for a moment after the selection changes.
            await waitFor(
              () =>
                editor.element.querySelector('[name="name"]')?.value ===
                "Second",
              "the detail pane to show the selected action",
            )
          })
        })

        it("renames the selected action", async () => {
          const item = await createItemWithActions()
          const first = actionNamed(item, "First")

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, first.id)

            await changeFormField(
              editor,
              "name",
              "Zap",
              () => !!actionNamed(item, "Zap"),
            )

            assert.isOk(actionNamed(item, "Zap"))
            assert.isOk(
              actionNamed(item, "Second"),
              "renaming one action should leave the other alone",
            )
          })
        })

        it("turns a capability on without disturbing the others", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          await item.updateAction(action.id, {
            flags: { ...action.flags, usesEffect: true, usesAttempt: false },
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            await changeFormField(
              editor,
              "flags.usesAttempt",
              true,
              () => item.getAction(action.id).flags.usesAttempt === true,
            )

            assert.isTrue(item.getAction(action.id).flags.usesAttempt)
            assert.isTrue(
              item.getAction(action.id).flags.usesEffect,
              "a form submission should not clear the flags it didn't touch",
            )
          })
        })

        it("disables the tabs an action doesn't use", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          await item.updateAction(action.id, {
            flags: {
              ...action.flags,
              usesAttempt: false,
              usesEffect: true,
              usesConsumption: false,
              usesRestrictions: false,
            },
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            const tab = (id) =>
              editor.element.querySelector(
                `[data-action="tab"][data-tab="${id}"]`,
              )

            assert.isTrue(tab("attempt").disabled, "attempt is switched off")
            assert.isTrue(tab("consumption").disabled)
            assert.isTrue(tab("restrictions").disabled)
            assert.isFalse(
              tab("effects").disabled,
              "effects is switched on and should be reachable",
            )
            assert.isFalse(
              tab("settings").disabled,
              "settings is always available",
            )
          })
        })

        it("adds an effect to the selected action", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          await item.updateAction(action.id, {
            flags: { ...action.flags, usesEffect: true },
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            click(editor, '[data-action="add-action-effect"]')

            await waitFor(
              () => item.getAction(action.id).effects.length === 1,
              "the effect to be added",
            )

            const [effect] = item.getAction(action.id).effects
            assert.isString(effect.id, "an effect needs an id of its own")
          })
        })

        it("deletes an effect once the deletion is confirmed", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          await item.updateAction(action.id, {
            flags: { ...action.flags, usesEffect: true },
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            click(editor, '[data-action="add-action-effect"]')
            await waitFor(
              () => item.getAction(action.id).effects.length === 1,
              "an effect to delete",
            )
            await renderApplication(editor)

            click(editor, '[data-action="delete-action-effect"]')
            await answerDialog(true)

            await waitFor(
              () => item.getAction(action.id).effects.length === 0,
              "the effect to be deleted",
            )
          })
        })

        it("keeps the effect when the deletion is dismissed", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          await item.updateAction(action.id, {
            flags: { ...action.flags, usesEffect: true },
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            click(editor, '[data-action="add-action-effect"]')
            await waitFor(
              () => item.getAction(action.id).effects.length === 1,
              "an effect to keep",
            )
            await renderApplication(editor)

            click(editor, '[data-action="delete-action-effect"]')
            await answerDialog(false)

            assert.lengthOf(
              item.getAction(action.id).effects,
              1,
              "backing out of the dialog should change nothing",
            )
          })
        })

        it("deletes an action and moves the selection to its neighbour", async () => {
          const item = await createItemWithActions()
          const first = actionNamed(item, "First")
          const second = actionNamed(item, "Second")

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, first.id)

            click(
              editor,
              `button[data-action="delete-action"][data-action-id="${first.id}"]`,
            )
            await answerDialog(true)

            await waitFor(
              () => item.system.actions.length === 1,
              "the action to be deleted",
            )

            assert.isUndefined(actionNamed(item, "First"))
            assert.strictEqual(
              editor._activeAction,
              second.id,
              "deleting the selected action should select another one",
            )
          })
        })

        it("clears the selection when the last action goes", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [only] = item.system.actions

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, only.id)

            click(
              editor,
              `button[data-action="delete-action"][data-action-id="${only.id}"]`,
            )
            await answerDialog(true)

            await waitFor(
              () => item.system.actions.length === 0,
              "the last action to be deleted",
            )

            assert.isNull(editor._activeAction)
          })
        })

        it("reorders actions by dragging one onto another", async () => {
          const item = await createItemWithActions()
          const first = actionNamed(item, "First")
          const second = actionNamed(item, "Second")

          await withEditor(item, "actionEditor", async (editor) => {
            const target = editor.element.querySelector(
              `.application__master-detail__master-item[data-action-id="${second.id}"]`,
            )

            dropOnto(target, { type: "Action", actionId: first.id })

            await waitFor(
              () => item.system.actions[0].id === second.id,
              "the actions to be reordered",
            )

            assert.deepEqual(
              item.system.actions.map((action) => action.name),
              ["Second", "First"],
            )
          })
        })

        it("reorders effects by dragging one onto another", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          const effects = [
            buildActionEffect({ name: "Alpha" }),
            buildActionEffect({ name: "Beta" }),
          ]
          await item.updateAction(action.id, {
            flags: { ...action.flags, usesEffect: true },
            effects,
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            const target = editor.element.querySelector(
              `.action-effects__effect[data-effect-id="${effects[1].id}"]`,
            )

            dropOnto(target, {
              type: "ActionEffect",
              actionId: action.id,
              effectId: effects[0].id,
            })

            await waitFor(
              () => item.getAction(action.id).effects[0].id === effects[1].id,
              "the effects to be reordered",
            )

            assert.deepEqual(
              item.getAction(action.id).effects.map((effect) => effect.name),
              ["Beta", "Alpha"],
            )
          })
        })

        it("opens the effect editor on the effect that was clicked", async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [action] = item.system.actions
          const effect = buildActionEffect({ name: "Scorch" })
          await item.updateAction(action.id, {
            flags: { ...action.flags, usesEffect: true },
            effects: [effect],
          })

          await withEditor(item, "actionEditor", async (editor) => {
            await selectAction(editor, action.id)

            try {
              click(
                editor,
                `button[data-action="edit-action-effect"][data-effect-id="${effect.id}"]`,
              )

              await waitFor(
                () => editor.subApps.effectEditor.rendered,
                "the effect editor to open",
              )

              // An input's value isn't part of its text content, so this has to
              // read the field rather than search the window for the name.
              assert.strictEqual(
                editor.subApps.effectEditor.element.querySelector(
                  '[name="name"]',
                )?.value,
                "Scorch",
                "the effect editor should be showing that effect",
              )
            } finally {
              await closeApplication(editor.subApps.effectEditor)
            }
          })
        })
      })

      // === The action effect editor ==========================================

      describe("The action effect editor", function effectEditor() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        /**
         * An Item with one action carrying two named effects.
         * @returns {Promise<{item: Item, action: object, effects: object[]}>}
         * The fixtures, with the action and effects as stored
         */
        const createItemWithEffects = async () => {
          const item = await createTestItem({ type: "item", name: "Wand" })
          await item.createAction()
          const [created] = item.system.actions

          await item.updateAction(created.id, {
            flags: { ...created.flags, usesEffect: true },
            // Type "effect" on purpose: the condition editor -- the part of this
            // window with anything to add or delete -- only renders for effects
            // that apply a condition.
            effects: [
              buildActionEffect({ name: "Scorch", type: "effect" }),
              buildActionEffect({ name: "Singe", type: "effect" }),
            ],
          })

          const action = item.getAction(created.id)

          // Read the effects back rather than reusing the ones just written: the
          // editor renders whatever object it's handed, and a half-built literal
          // would render a half-built form.
          return { item, action, effects: action.effects }
        }

        /**
         * Open the effect editor on a specific effect.
         * @param {Item} item - The Item being edited
         * @param {object} action - The action the effect belongs to
         * @param {object} effect - The effect to edit
         * @param {(app: object) => Promise<void>} callback - The test
         * @returns {Promise<void>} Resolves once the editor is closed
         */
        const withEffectEditor = async (item, action, effect, callback) => {
          // The effect editor keeps its own idea of what it's editing, handed to
          // it by `prepareToEdit` -- it doesn't read the action editor's
          // selection, so the parent doesn't need to be set up or opened.
          const effects = item.sheet.subApps.actionEditor.subApps.effectEditor

          effects.prepareToEdit(action, effect)

          await renderApplication(effects)

          try {
            await callback(effects)
          } finally {
            await closeApplication(effects)
          }
        }

        it("shows the effect it was prepared with", async () => {
          const { item, action, effects } = await createItemWithEffects()

          await withEffectEditor(item, action, effects[1], (editor) => {
            assert.strictEqual(
              editor.element.querySelector('[name="name"]').value,
              "Singe",
            )
          })
        })

        it("saves a change to that effect and no other", async () => {
          const { item, action, effects } = await createItemWithEffects()

          await withEffectEditor(item, action, effects[0], async (editor) => {
            await changeFormField(
              editor,
              "name",
              "Scald",
              () => item.getAction(action.id).effects[0].name === "Scald",
            )

            const saved = item.getAction(action.id).effects

            assert.strictEqual(saved[0].name, "Scald")
            assert.strictEqual(
              saved[1].name,
              "Singe",
              "editing one effect should leave its siblings alone",
            )
          })
        })

        it("adds a condition change", async () => {
          const { item, action, effects } = await createItemWithEffects()

          await withEffectEditor(item, action, effects[0], async (editor) => {
            const changeCount = () =>
              item.getAction(action.id).effects[0].condition.changes.length

            assert.strictEqual(changeCount(), 0)

            click(editor, '[data-action="add-condition-change"]')

            await waitFor(() => changeCount() === 1, "the change to be added")
          })
        })

        it("deletes a condition change once confirmed", async () => {
          const { item, action, effects } = await createItemWithEffects()

          await withEffectEditor(item, action, effects[0], async (editor) => {
            const changeCount = () =>
              item.getAction(action.id).effects[0].condition.changes.length

            click(editor, '[data-action="add-condition-change"]')
            await waitFor(() => changeCount() === 1, "a change to delete")
            await renderApplication(editor)

            click(editor, '[data-action="delete-condition-change"]')
            await answerDialog(true)

            await waitFor(() => changeCount() === 0, "the change to be deleted")
          })
        })
      })
    },
    { displayName: "BAGS: Action and effect editing" },
  )
}
