/**
 * @file Register helpers for Handlebars.
 */
import numberToOrdinal from "../utils/number-to-ordinal.mjs"

Hooks.once("init", () => {
  Handlebars.registerHelper({
    add: (a, b) => a + b,
    repeat: (length) => new Array(length).fill(null),
    ordinal: (value) => numberToOrdinal(value || 0),
    signNumber: (number, options) => {
      const num = Number(number)
      if (Number.isNaN(num)) return number
      const settings = {
        showZeroSign: false, // whether to show sign for zero
        zeroSign: "+", // sign to use for zero ('+' or '±')
        forceSign: false, // whether to always show + for positive numbers
        ...options.hash,
      }
      if (num > 0) return `${settings.forceSign ? "+" : ""}${num}`
      if (num < 0) return num.toString()
      return `${settings.showZeroSign ? settings.zeroSign : ""}0`
    },
  })
})
