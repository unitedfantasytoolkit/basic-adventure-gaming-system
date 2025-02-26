/**
 * @file Utility functions for development-only code
 */

/**
 * Executes the provided function only in development mode
 * @param {Function} fn - The function to execute in development mode
 * @returns {void}
 */
export function devOnly(fn) {
  try {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      fn()
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e.message)
  }
}

/**
 * Logs messages only in development mode
 * @param {...any} args - Arguments to pass to console.log
 * @returns {void}
 */
export function devLog(...args) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log("[DEV]", ...args)
  }
}
