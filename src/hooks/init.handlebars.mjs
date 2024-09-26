/**
 * @file Register helpers for Handlebars.
 */
import numberToOrdinal from "../utils/number-to-ordinal.mjs"

Hooks.once("init", () => {
  Handlebars.registerHelper({
    add: (a, b) => a + b,
    repeat: (length) => new Array(length).fill(null),
    ordinal: (value) => numberToOrdinal(value || 0),
  })
})
