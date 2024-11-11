/**
 * @file A util that gets an item's actors of a specific type, optionally
 * filtered by another function.
 */

const getItemsOfActorOfType = (actor, filterType, filterFn = null) =>
  actor.items
    .filter(({ type }) => type === filterType)
    .filter(filterFn || (() => true))

export default getItemsOfActorOfType
