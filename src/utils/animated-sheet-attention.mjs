/**
 * @file A util that animates the UI in response to an error on an App.
 */

/**
 * The CSS class that marks an app as in an error state.
 * @constant
 */
export const ANIMATE_GET_ATTENTION_CLASS = "animate--attention"

/**
 * Given a form and an error, report the error and shake the offending UI
 * element.
 * @param {HTMLElement} element - The parent element of the App to shake.
 * @param {string} msg - The message to display.
 */
export default (element, msg) => {
  try {
    element.addEventListener("animationend", () => {
      element.classList.remove(ANIMATE_GET_ATTENTION_CLASS)
    })
    element.classList.add(ANIMATE_GET_ATTENTION_CLASS)

    if (msg) ui.notifications.info(msg)
  } catch {
    // noop; don't break anything if our fancy message fails.
  }
}
