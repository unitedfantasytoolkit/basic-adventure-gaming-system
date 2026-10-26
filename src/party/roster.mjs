/**
 * @file Reducing a character to the numbers one row of the Party tab shows.
 *
 * Separate from the tab so a system built on BAGS can change what a row says
 * without touching the application class.
 */

/**
 * The fraction of maximum hit points at or below which a character is shown as
 * hurt.
 * @type {number}
 */
const HURT_THRESHOLD = 0.5

/**
 * One row of the party roster, ready for the template.
 * @typedef {object} PartyMemberContext
 * @property {string} id - The Actor's id
 * @property {string} name - The character's name
 * @property {string} img - The character's portrait
 * @property {boolean} isOwner - Whether the current user owns this character
 * @property {string} cssClass - State classes for the row: `hurt` or `dead`
 * @property {object} hp - Hit points, plus the fraction remaining for the bar
 * @property {number} armorClass - The character's armor class
 * @property {object} encumbrance - Load carried, and whether it's slowing them
 * @property {number} speed - Exploration movement rate
 * @property {string|null} classLabel - The character's class and level, if any
 * @property {boolean} hasToken - Whether the character is on the current scene
 */

/**
 * Find a character's token on the scene being viewed.
 *
 * The row's canvas controls are only rendered when this finds something.
 * @param {Actor} actor - The party member
 * @returns {Token|null} The character's token, or null if they aren't here
 */
export const getMemberToken = (actor) => {
  if (!canvas?.ready) return null
  const [token] = actor.getActiveTokens()
  return token ?? null
}

/**
 * Reduce a character down to the handful of numbers the roster shows.
 * @param {Actor} actor - The party member
 * @returns {PartyMemberContext} The row context for this member
 */
export const getMemberContext = (actor) => {
  const { system } = actor
  const [classItem = null] = actor.itemTypes.class ?? []

  const hp = {
    value: system.hp?.value ?? 0,
    max: system.hp?.max ?? 0,
  }

  // Clamped because a character healed past their maximum shouldn't overflow the
  // bar, and one at negative hit points shouldn't invert it.
  hp.fraction = hp.max ? Math.clamp(hp.value / hp.max, 0, 1) : 0

  const load = system.encumbrance?.value ?? 0
  const thresholds = system.encumbrance?.thresholds ?? {}

  const state = []
  if (hp.value <= 0) state.push("dead")
  else if (hp.fraction <= HURT_THRESHOLD) state.push("hurt")

  return {
    id: actor.id,
    name: actor.name,
    img: actor.img,
    isOwner: actor.isOwner,
    cssClass: state.join(" "),
    hp,
    armorClass: system.armorClass,
    encumbrance: {
      value: load,
      max: thresholds.maximum ?? 0,
      // In B/X it's carrying significant treasure that slows a character down,
      // well before they reach their maximum load.
      isSlowed: !!thresholds.significant && load >= thresholds.significant,
      isFull: !!thresholds.maximum && load >= thresholds.maximum,
    },
    speed: system.speed?.exploration ?? 0,
    classLabel: classItem
      ? game.i18n.format("BAGS.Party.Members.ClassLabel", {
          className: classItem.name,
          level: classItem.system?.level ?? 1,
        })
      : null,
    hasToken: !!getMemberToken(actor),
  }
}

/**
 * How fast the party moves as a group: the rate of its slowest member.
 * @param {PartyMemberContext[]} members - The roster
 * @returns {{speed: number, slowest: string}|null} The party's rate and who sets
 * it, or null when there's nobody to measure
 */
export const getMarchingRate = (members) => {
  const measurable = members.filter((member) => member.speed > 0)
  if (!measurable.length) return null

  const slowest = measurable.reduce((current, member) =>
    member.speed < current.speed ? member : current,
  )

  return { speed: slowest.speed, slowest: slowest.name }
}
