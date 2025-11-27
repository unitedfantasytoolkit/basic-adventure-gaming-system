/**
 * @file Formats numbers with explicit + or - signs.
 * Used throughout the UI to clearly show bonuses and penalties.
 * Makes it obvious at a glance whether a modifier helps or hurts you.
 */

/**
 * Formats a number with an explicit sign (+/-).
 * Positive numbers get a + prefix, negative numbers keep their -, and zero can
 * optionally show + or ± depending on configuration. Useful for displaying
 * modifiers where you want to be crystal clear about the direction of effect.
 * @param {number|string} number - The number to format
 * @param {object} options - Handlebars hash options
 * @param {boolean} options.hash.showZeroSign - Whether to show a sign for zero
 * @param {string} options.hash.zeroSign - Which sign to use for zero ('+' or '±')
 * @param {boolean} options.hash.forceSign - Whether to always show + for positive
 * @returns {string} The formatted number with sign
 * @example
 * signNumber(5)   // Returns "+5"
 * signNumber(-3)  // Returns "-3"
 * signNumber(0)   // Returns "0" (or "+0" if showZeroSign: true)
 */
export default (number, options) => {
  const num = Number(number)
  if (Number.isNaN(num)) return number
  const settings = {
    showZeroSign: false, // whether to show sign for zero
    zeroSign: "+", // sign to use for zero ('+' or '±')
    forceSign: true, // whether to always show + for positive numbers
    ...options?.hash,
  }
  if (num > 0) return `${settings.forceSign ? "+" : ""}${num}`
  if (num < 0) return num.toString()
  return `${settings.showZeroSign ? settings.zeroSign : ""}0`
}
