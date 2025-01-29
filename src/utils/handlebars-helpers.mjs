export function getActionFlavorText(action, message) {
  const { actor, item, details, outcome } = action;
  
  if (details.attempt.flavorText.attempt) {
    return game.i18n.localize(details.attempt.flavorText.attempt, {
      name: actor.name,
      target: outcome[0]?.target?.name,
      item: item?.name
    });
  }

  const hasTarget = outcome[0]?.target;
  const hasItem = !!item;
  const key = details.attempt.flags.isLikeAttack ? 'Attack' : 'Static';
  
  let suffix = 'WithoutItemOrTarget';
  if (hasTarget && hasItem) suffix = 'WithTargetAndItem';
  else if (hasTarget) suffix = 'WithoutItem';
  else if (hasItem) suffix = 'WithoutTarget';

  return game.i18n.localize(`BAGS.ChatCards.Action.Attempt.${key}.ContextualDescription.${suffix}`, {
    actor: actor.name,
    target: outcome[0]?.target?.name,
    item: item?.name
  });
}

export function getBlindFlavorText(action) {
  const { details, actor, target, item } = action;
  const key = details.attempt.flavorText.blind || "BAGS.ChatCards.Action.Attempt.Result.Blind";
  
  return game.i18n.localize(key, {
    name: actor.name,
    target: target?.name,
    item: item?.name
  });
}
