/**
 * @file A util that animates the UI in response to an error on an App.
 */

/**
 * The CSS class that marks an app as in an error state.
 * @constant
 */
export const ANIMATE_ERROR_CLASS = "animate--error"

/**
 * Given a form and an error, report the error and shake the offending UI
 * element.
 * @param {HTMLElement} element - The parent element of the App to shake.
 * @param {string} msg - The message to display.
 */
export default (element, msg) => {
  try {
    element.addEventListener("animationend", () => {
      element.classList.remove(ANIMATE_ERROR_CLASS)
    })
    element.classList.add(ANIMATE_ERROR_CLASS)

    if (msg) ui.notifications.error(msg, { localize: true })
  } catch {
    // noop; don't break anything if our fancy error message fails.
  }
}
