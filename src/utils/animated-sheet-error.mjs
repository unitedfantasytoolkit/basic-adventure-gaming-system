/**
 * @file A util that animates the UI in response to an error on an App.
 */

/**
 * Given a form and an error, report the error and shake the offending UI
 * element.
 * @param {HTMLElement} element - The parent element of the App to shake.
 * @param {string} msg - The message to display.
 */
const animatedSheetError = (element, msg) => {
  // @todo add class to shake the window on an error

  ui.notifications.error(msg)
}

export default animatedSheetError
