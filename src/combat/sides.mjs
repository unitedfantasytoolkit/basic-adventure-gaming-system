/**
 * @file Sides: which faction a combatant or group belongs to.
 *
 * A side is not the same thing as a group. A group is the thing that rolls
 * initiative together; a side is who it is fighting for. They usually coincide
 * -- the party is one group and one side -- but a GM who rolls separately for
 * two warbands on the same side has two groups and one side, and that has to be
 * expressible. Foundry's CombatantGroup documents cannot nest, so side lives as
 * a plain field rather than as a second layer of grouping.
 *
 * Side does not affect turn order at all. It exists for simultaneous-action ties
 * between opposing sides, for morale, and for answering "is this thing hostile
 * to me". None of those are the turn sequence.
 */

/**
 * The sides a combatant or group can belong to.
 * @readonly
 * @enum {string}
 */
export const SIDES = Object.freeze({
  PARTY: "party",
  HOSTILE: "hostile",
  NEUTRAL: "neutral",
})

/**
 * Every side, for use as a data model field's `choices`.
 * @type {readonly string[]}
 */
export const SIDE_VALUES = Object.freeze(Object.values(SIDES))

/**
 * Translation keys for each side, so the tracker and the group manager label
 * them the same way.
 * @type {Readonly<Record<string, string>>}
 */
export const SIDE_LABELS = Object.freeze({
  [SIDES.PARTY]: "BAGS.Combat.Sides.Party",
  [SIDES.HOSTILE]: "BAGS.Combat.Sides.Hostile",
  [SIDES.NEUTRAL]: "BAGS.Combat.Sides.Neutral",
})

/**
 * The colour a group takes when nobody has picked one.
 *
 * These live here rather than in the stylesheet because the group manager's
 * colour picker has to show the colour a group is *currently* using, including
 * the inherited one. Two copies of these values would drift, so the tracker
 * writes the accent inline from here and the stylesheet only supplies a fallback
 * for anything that somehow renders without it.
 * @type {Readonly<Record<string, string>>}
 */
export const SIDE_COLORS = Object.freeze({
  [SIDES.PARTY]: "#4d7c3f",
  [SIDES.HOSTILE]: "#8c3b3b",
  [SIDES.NEUTRAL]: "#8a7433",
})

/**
 * Work out the colour a group should be drawn in.
 *
 * An explicitly chosen colour always wins; otherwise the side supplies one. That
 * ordering is what lets a table drop tokens in and get sensible red-and-green
 * for free, while still being able to tell two hostile warbands apart.
 * @param {object} [group] - A CombatantGroup, or anything with `system`.
 * @returns {string} A CSS colour.
 */
export const colorForGroup = (group) => {
  const chosen = group?.system?.color
  if (chosen) return chosen.css ?? String(chosen)

  return SIDE_COLORS[group?.system?.side] ?? SIDE_COLORS[SIDES.HOSTILE]
}

/**
 * Work out which side a token belongs to from how it is displayed on the canvas.
 *
 * This is a guess, not a rule. It is right often enough to make dropping a dozen
 * tokens into a fight a zero-click operation, and a GM can always correct it
 * afterwards -- a charmed party member is still displayed as friendly, and no
 * amount of reading the token would reveal otherwise.
 *
 * Secret tokens are treated as hostile: the GM knows what they are, and putting
 * them with the party would leak that they are friendly.
 * @param {number} [disposition] - A CONST.TOKEN_DISPOSITIONS value.
 * @returns {string} One of SIDES.
 */
export const sideFromDisposition = (disposition) => {
  const { FRIENDLY, NEUTRAL } = CONST.TOKEN_DISPOSITIONS

  switch (disposition) {
    case FRIENDLY:
      return SIDES.PARTY
    case NEUTRAL:
      return SIDES.NEUTRAL
    default:
      return SIDES.HOSTILE
  }
}
