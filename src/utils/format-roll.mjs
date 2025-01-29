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
