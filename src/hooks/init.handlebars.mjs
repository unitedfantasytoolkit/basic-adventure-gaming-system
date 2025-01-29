/**
 * @file Register helpers for Handlebars.
 */
import formatRoll from "../utils/format-roll.mjs"
import getActionFlavorText from "../utils/get-action-flavor-text.mjs"
import getBlindFlavorText from "../utils/get-blind-flavor-text.mjs"
import numberToOrdinal from "../utils/number-to-ordinal.mjs"
import signNumber from "../utils/sign-number.mjs"

Hooks.once("init", () => {
  Handlebars.registerHelper({
    add: (a, b) => a + b,
    repeat: (length) => new Array(length).fill(null),
    ordinal: (value) => numberToOrdinal(value || 0),
    signNumber,
    formatRoll,
    getActionFlavorText,
    getBlindFlavorText,
  })
})
