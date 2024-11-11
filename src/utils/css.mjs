/**
 * @file A helper function that makes editors provide syntax highlighting
 * for CSS.
 */

/**
 * Provide syntax highlighting for CSS strings. Does nothing otherwise.
 * @param {string[]} strings - Incoming strings
 * @param {any[]} values - Incoming template values
 * @returns {string} The same value it was given.
 */

export const css = (strings, ...values) =>
  String.raw({ raw: strings }, ...values)

export default css
