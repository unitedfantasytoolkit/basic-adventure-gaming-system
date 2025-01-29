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
