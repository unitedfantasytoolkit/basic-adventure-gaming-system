/**
 * @file A helper function that rolls dice and returns a Roll.
 */

import { REROLL_TYPE } from "../config/constants.mjs"

/**
 * Rolls dice based on a formula.
 * @param {object} actor - The Actor that is rolling the dice.
 * @param {string} dice - The dice formula to roll (e.g., "1d20+5").
 * @param {object} config - Modifiers for the dice formula.
 * @param {string} config.operator - The operator to use when comparing the result to the target.
 * @param {number} config.modifier - A numeric modifier to apply to the roll.
 * @param {string} config.target - The value to compare the rolled result against.
 * @param {number} config.rollType - Does this formula roll twice? If so, does it take the higher or lower Roll?
 * @returns {object} The result of the roll, including total and any error.
 */
const rollDice = async (
  actor,
  dice,
  { operator, target, modifier, rollType } = {}
) => {
  let formula = dice
  if (modifier) formula = `${formula}+${modifier}`
  if (target) formula = `${formula}cs${operator || ">="}${target}`

  const roll = new Roll(formula, actor.getRollData())
  const reroll = rollType ? roll.clone() : null

  await roll.evaluate()
  await reroll?.evaluate()

  if (rollType === REROLL_TYPE.TAKE_WORST && reroll._evaluated)
    return roll.total <= reroll.total ? roll : reroll
  if (rollType === REROLL_TYPE.TAKE_BEST && reroll._evaluated)
    return roll.total >= reroll.total ? roll : reroll

  return roll
}

export default rollDice
