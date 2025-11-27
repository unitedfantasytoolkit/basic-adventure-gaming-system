/**
 * @file Formats dice roll notation into human-readable text for display.
 * Handles classic B/X conventions like "X-in-6" chances and percentage rolls,
 * making roll requirements clearer for players.
 */

/**
 * Converts roll formula, operator, and target into readable format.
 * B/X games use specific conventions that players expect to see - searching is
 * "1-in-6", thief skills are percentages, etc. This formats those consistently.
 * @param {string|number} formula - The dice formula (e.g., "1d20", "1d6", "1d100")
 * @param {string} operator - Comparison operator ("<=", ">=", "<", ">", "==", "!=")
 * @param {number} target - The target number to beat or roll under
 * @returns {string} Formatted roll description (e.g., "3-in-6", "45%", "1d20 ≥ 15")
 * @example
 * formatRoll("1d6", "<=", 3)  // Returns "3-in-6"
 * formatRoll("1d100", "<=", 45)  // Returns "45%"
 * formatRoll("1d20", ">=", 15)  // Returns "1d20 ≥ 15"
 */
export default (formula, operator, target) => {
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
}
