/**
 * @file Shared fixtures for driving an editor the way a user does.
 *
 * These live apart from `helpers.mjs` because they need a batch's `assert`: a
 * missing button or a sub-application that isn't there should fail the test that
 * asked for it, with a message naming what it was looking for, rather than throw
 * a `TypeError` from somewhere further down.
 *
 * Every editor in the system works the same way -- Foundry calls a static handler
 * with `this` bound to the application, the handler reads the DOM event, mutates
 * the document and re-renders -- so the same four fixtures cover all of them.
 */

import { closeApplication, renderApplication } from "./helpers.mjs"

/**
 * Build the editor fixtures for a batch.
 *
 * Call this once at the top of a batch, next to the `describe`/`it` unpacking:
 *
 * ```javascript
 * const { withEditor, click } = editorTools(context)
 * ```
 * @param {object} context - The Quench batch context
 * @returns {object} `withEditor`, `click`, `invokeAction` and `dropOnto`
 */
export default function editorTools(context) {
  const { assert } = context

  /**
   * Click something in an application, the way a user would.
   *
   * Foundry delegates `data-action` clicks from the application's root element,
   * so this goes through the same dispatch a real click does -- including the
   * `data-action-id` and `data-effect-id` attributes the handlers read off the
   * element they were clicked on.
   * @param {object} app - The rendered application
   * @param {string} selector - A CSS selector for the thing to click
   * @returns {HTMLElement} The element that was clicked
   */
  const click = (app, selector) => {
    const element = app.element.querySelector(selector)

    assert.isOk(element, `nothing matching "${selector}" to click`)
    element.click()

    return element
  }

  /**
   * Open an editor and hand it to a callback, closing it afterwards.
   *
   * Sub-applications are constructed with their sheet, so this reaches them
   * through the sheet the way the sheet's own buttons do. The sheet itself is
   * left closed: an editor doesn't need its parent on screen, and keeping one
   * window in play makes a failure easier to read.
   * @param {object} document - The Actor or Item being edited
   * @param {string} subApp - The key in the sheet's `SUB_APPS`
   * @param {(app: object) => Promise<void>} callback - The test
   * @returns {Promise<void>} Resolves once the editor is closed again
   */
  const withEditor = async (document, subApp, callback) => {
    const editor = document.sheet.subApps[subApp]

    assert.isOk(editor, `no "${subApp}" sub-application on this sheet`)

    await renderApplication(editor)

    try {
      await callback(editor)
    } finally {
      await closeApplication(editor)
      // Some editors open the document's sheet when they save -- the class
      // advancement editor does it unconditionally -- so tidy that up too rather
      // than leaving a window behind for the next test to trip over.
      if (document.sheet?.rendered) await closeApplication(document.sheet)
    }
  }

  /**
   * Invoke one of an application's registered actions.
   *
   * This is how to reach a header control. In v14 those aren't in the
   * application's DOM at all: they're built on demand as a context menu hanging
   * off the "..." button. Calling the registered handler is the same dispatch
   * Foundry performs when one of those entries is picked, and it still proves the
   * wiring -- that the sheet declares the action, and that the action opens the
   * right window.
   * @param {object} app - The application
   * @param {string} action - The `data-action` name
   * @returns {Promise<void>} Resolves once the handler has run
   */
  const invokeAction = async (app, action) => {
    const entry = app.options.actions[action]
    const handler = typeof entry === "function" ? entry : entry?.handler

    assert.isFunction(handler, `no "${action}" action on this sheet`)

    await handler.call(app, new MouseEvent("click"), null)
  }

  /**
   * Drop one element onto another, carrying the given drag payload.
   *
   * The editors read their payload out of `dataTransfer`, so a synthetic click
   * won't do -- but a real DragEvent with a real DataTransfer will, and it
   * arrives through the same `DragDrop` binding as a player's drag.
   * @param {HTMLElement} target - The element being dropped on
   * @param {object} payload - The drag data, as the editor writes it
   * @returns {void}
   */
  const dropOnto = (target, payload) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData("text/plain", JSON.stringify(payload))

    target.dispatchEvent(new DragEvent("drop", { dataTransfer, bubbles: true }))
  }

  return { click, withEditor, invokeAction, dropOnto }
}
