/**
 * @file Deciding whether an actor is far enough along to use an action.
 *
 * Actions can be restricted to a range of levels -- a thief's backstab arriving
 * at 1st, a class ability that a later one replaces at 5th. Two places need the
 * same answer to that question and must not disagree: the sheet, which decides
 * what to put on the Actions tab, and the resolver, which decides whether to go
 * ahead when something is used. Both read this file.
 *
 * The functions here are deliberately pure and take plain values, so they can be
 * unit tested without a running Foundry -- and so the resolver, which is written
 * to be testable against fake documents, can keep using them.
 */

/**
 * The level an action's restrictions should be measured against.
 *
 * "Level" is not a property of a character in this system -- it's a property of
 * a class. A fighter 3 / magic-user 1 is 3rd level for the things fighting got
 * them and 1st level for the things magic did, so an action that came off a
 * class Item is judged by *that class's* level rather than by anything about the
 * character as a whole.
 *
 * Anything else -- an ancestry, a loose ability, a wand -- has no class to point
 * at, so it falls back to what the actor as a whole amounts to: their best class
 * level, or a monster's hit dice.
 * @param {object|null} source - The Item the action came from, if any
 * @param {object|null} actor - The Actor using it
 * @returns {number|null} The governing level, or null if nothing has one
 */
export function levelForAction(source, actor) {
  const sourceLevel = source?.system?.actionLevel

  if (typeof sourceLevel === "number") return sourceLevel

  const actorLevel = actor?.system?.level

  return typeof actorLevel === "number" ? actorLevel : null
}

/**
 * Whether an action's level restrictions permit it at the given level.
 *
 * Restrictions only apply when the action says it has them. `level.min` and
 * `level.max` keep whatever was last typed into the action editor even after the
 * restrictions checkbox is cleared, so honouring them regardless of the flag
 * would enforce limits the author had explicitly turned off.
 *
 * An unknown level -- a world Item nobody owns, a vehicle -- permits everything.
 * Refusing to act because we couldn't work out whose level to check would be a
 * worse failure than letting it through.
 * @param {object} action - The action being checked
 * @param {number|null} level - The governing level, from {@link levelForAction}
 * @returns {boolean} Whether the action is available
 */
export function meetsLevelRestrictions(action, level) {
  if (!action?.flags?.usesRestrictions) return true
  if (typeof level !== "number") return true

  const { min, max } = action.level ?? {}

  if (typeof min === "number" && level < min) return false
  if (typeof max === "number" && level > max) return false

  return true
}

/**
 * Whether an actor can use an action right now, restrictions and all.
 *
 * The convenience wrapper the sheet uses; the resolver takes the two steps
 * separately because it needs the level to explain itself when it refuses.
 * @param {object} action - The action being checked
 * @param {object|null} source - The Item the action came from, if any
 * @param {object|null} actor - The Actor using it
 * @returns {boolean} Whether the action is available
 */
export function isActionAvailable(action, source, actor) {
  return meetsLevelRestrictions(action, levelForAction(source, actor))
}

/**
 * Whether a limited action has been used up.
 *
 * This is deliberately not part of {@link isActionAvailable}, because the two
 * are different kinds of "no". Being too junior for an ability is a fact about
 * the character, so the control doesn't appear at all; spending the last charge
 * is temporary, so the control stays put and greys out. Taking it away would
 * hide the reason it's gone along with the thing itself.
 *
 * The condition mirrors the resolver's own check, so what looks spent is exactly
 * what would be refused.
 * @param {object} action - The action being checked
 * @returns {boolean} Whether the action has no uses left
 */
export function isActionExhausted(action) {
  return action?.uses?.max > 0 && action.uses.value <= 0
}
