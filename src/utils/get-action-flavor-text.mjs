/**
 * @file Generates contextual flavor text for action chat messages.
 * Creates natural language descriptions like "Grognar attacks the Goblin with his sword"
 * based on what information is available about the action.
 */

/**
 * Builds descriptive flavor text for an action attempt based on context.
 * The text changes based on whether there's a target, item, or custom flavor text.
 * Falls back to sensible defaults using translation keys.
 * @param {object} action - The action being performed
 * @param {Actor} action.actor - The actor performing the action
 * @param {Item} action.item - The item being used (if any)
 * @param {object} action.details - Action configuration details
 * @param {Array} action.outcome - Array of action outcomes (includes targets)
 * @param {object} message - The chat message being created
 * @returns {string} Localized flavor text describing the action
 * @example
 * // With target and item: "Grognar attacks the Goblin with his Longsword"
 * // Without target: "Grognar attacks with his Longsword"
 * // Without item: "Grognar attacks the Goblin"
 */
export default (action, message) => {
  const { actor, item, details, outcome } = action

  if (details.attempt.flavorText.attempt) {
    return game.i18n.format(details.attempt.flavorText.attempt, {
      name: actor.name,
      target: outcome[0]?.target?.name,
      item: item?.name,
    })
  }

  const hasTarget = outcome[0]?.target
  const hasItem = !!item
  const key = details.attempt.flags.isLikeAttack ? "Attack" : "Static"

  let suffix = "WithoutItemOrTarget"
  if (hasTarget && hasItem) suffix = "WithTargetAndItem"
  else if (hasTarget) suffix = "WithoutItem"
  else if (hasItem) suffix = "WithoutTarget"

  return game.i18n.format(
    `BAGS.ChatCards.Action.Attempt.${key}.ContextualDescription.${suffix}`,
    {
      actor: actor.name,
      target: outcome[0]?.target?.name,
      item: item?.name,
    },
  )
}
