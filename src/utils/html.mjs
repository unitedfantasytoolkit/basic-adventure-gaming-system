/**
 * @file A helper function that makes editors provide syntax highlighting
 * for HTML.
 */

/**
 * Provide syntax highlighting for HTML strings. Does nothing otherwise.
 * @param {string[]} strings - Incoming strings
 * @param {any[]} values - Incoming template values
 * @returns {string} The same value it was given.
 */
const html = (strings, ...values) => String.raw({ raw: strings }, ...values)

export default html
