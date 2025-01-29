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
