/**
 * @file Builds HTML tooltip content showing roll breakdown and modifiers.
 * Used in chat cards to show players how their dice rolled and what bonuses applied.
 */

import html from "./html.mjs"

/**
 * Creates tooltip HTML showing dice roll breakdown with modifiers.
 * @param {object} tooltipData - Data about the roll
 * @param {Roll} tooltipData.roll - The Foundry Roll object
 * @param {Array<{label: string, value: number}>} tooltipData.modifiers - Applied modifiers
 * @param {string} tooltipData.type - Type of roll (attack, damage, etc)
 * @returns {string} HTML string for tooltip content
 * @example
 * buildRollTooltip({
 *   roll: Roll("1d20+2"),
 *   modifiers: [{label: "Melee Bonus", value: 2}],
 *   type: "attack"
 * })
 * // Returns: "<div class='roll-tooltip'>...</div>"
 */
export default function buildRollTooltip(tooltipData) {
  if (!tooltipData?.roll) return ""

  const { roll, modifiers = [], type = "roll" } = tooltipData

  // Extract the base die roll result (first term is usually the die)
  const baseDie = roll.terms[0]
  let diceDisplay = ""

  if (baseDie?.faces) {
    // It's a Die term (e.g., d20, d8)
    const results = baseDie.results || []
    const diceValues = results.map((r) => r.result).join(", ")
    const formula = baseDie.expression || `${baseDie.number}d${baseDie.faces}`

    diceDisplay = html`<div class="tooltip-dice">
      <span class="tooltip-dice__formula">${formula}:</span>
      <span class="tooltip-dice__results">${diceValues}</span>
    </div>`
  } else if (baseDie?.total !== undefined) {
    // It's a numeric term
    diceDisplay = html`<div class="tooltip-dice">
      <span class="tooltip-dice__results">${baseDie.total}</span>
    </div>`
  }

  // Build modifier rows
  const modifierRows = modifiers
    .filter((m) => m.value !== 0)
    .map(
      (m) => html`<div class="tooltip-modifier">
        ${m.value > 0 ? "+" : ""}${m.value}
        <span class="tooltip-modifier__label">(${m.label})</span>
      </div>`,
    )
    .join("")

  // Build the complete tooltip
  return html`<div class="roll-tooltip roll-tooltip--${type}">
    ${diceDisplay} ${modifierRows}
    ${modifierRows ? '<hr class="tooltip-divider" />' : ""}
    <div class="tooltip-total">
      <span class="tooltip-total__label">Total:</span>
      <span class="tooltip-total__value">${roll.total}</span>
    </div>
  </div>`
}
