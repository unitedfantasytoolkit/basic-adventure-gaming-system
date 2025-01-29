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
    formatRoll: (formula, operator, target) => {
      // Sanitize inputs
      const safeFormula = String(formula).trim().toLowerCase()
      const safeOperator = String(operator)
        .replace(/≤/g, "<=")
        .replace(/≥/g, ">=")
        .trim()
      const numericTarget = Math.round(Number(target)) || 0

      // B/X standard formats
      if (safeFormula === "1d6" && safeOperator === "<=") {
        // Classic X-in-6 chance (doors, searching, etc.)
        const capped = Math.min(Math.max(numericTarget, 0), 6)
        return `${capped}-in-6`
      }

      if (safeFormula === "1d100" && safeOperator === "<=") {
        // Thief skills and similar percentage rolls
        const capped = Math.min(Math.max(numericTarget, 0), 100)
        return `${capped}%`
      }

      // Standard notation for everything else
      const operatorSymbols = {
        "<=": "≤",
        ">=": "≥",
        "<": "<",
        ">": ">",
        "==": "=",
        "!=": "≠",
      }

      return `${safeFormula} ${operatorSymbols[safeOperator]} ${numericTarget}`
    },
  })
})
