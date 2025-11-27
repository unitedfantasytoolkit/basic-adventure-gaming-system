/**
 * @file Generates blind roll flavor text for private GM rolls.
 * When the GM makes a roll that players shouldn't see details of, this provides
 * generic text that doesn't reveal too much information.
 */

/**
 * Gets generic flavor text for blind/private rolls.
 * Hides specifics about the action, target, or item to maintain mystery when
 * the GM is rolling secretly (like for surprise checks or hidden traps).
 * @param {object} action - The action being performed
 * @param {object} action.details - Action configuration
 * @param {Actor} action.actor - The actor performing the action
 * @param {Actor} action.target - The target of the action (if any)
 * @param {Item} action.item - The item being used (if any)
 * @returns {string} Localized generic flavor text for blind rolls
 */
export default (action) => {
  const { details, actor, target, item } = action
  const key =
    details.attempt.flavorText.blind ||
    "BAGS.ChatCards.Action.Attempt.Result.Blind"

  return game.i18n.localize(key, {
    name: actor.name,
    target: target?.name,
    item: item?.name,
  })
}
