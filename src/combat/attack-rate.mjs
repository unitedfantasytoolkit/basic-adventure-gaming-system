/**
 * @file Working out how often a combatant acts, and with what.
 *
 * Two questions a segment-based ruleset has to answer before it can place
 * anyone, and both have more than one plausible source:
 *
 * 1. **Which weapon is this combatant using?** A declaration can name one, but
 *    nothing forces it to, so there is a fallback.
 * 2. **How many attacks do they get?** A character has a rate, and a missile
 *    weapon has its own. They are alternatives, never factors.
 *
 * Kept apart from the rules presets on purpose. A preset should say what its
 * edition *does* with an attack rate, not carry the search for one -- and this
 * is the single place a future weapon-specialization feature would change, since
 * specialization alters a character's rate for particular kinds of weapon.
 */

/**
 * Where an attack rate came from.
 *
 * Worth returning alongside the number, because "two attacks" from a fighter and
 * "two shots" from a bow are the same value for different reasons, and a
 * ruleset may care which.
 * @readonly
 * @enum {string}
 */
export const RATE_SOURCE = Object.freeze({
  /** The combatant's own attacks per round. */
  ACTOR: "actor",
  /** The weapon's rate of fire. */
  WEAPON: "weapon",
  /** Nothing said otherwise, so once. */
  DEFAULT: "default",
})

/**
 * Find the weapon a combatant is attacking with.
 *
 * Prefers what the declaration actually names. Declarations can bind to an item
 * -- that is what `bindsToAction` is for -- but the form does not yet offer the
 * choice, so in practice this falls through to what the combatant has in hand.
 * Falling back is the right behaviour regardless: a table that never binds items
 * to declarations should still get weapon speed out of the weapon they are
 * visibly holding.
 *
 * Ambiguity resolves to nothing rather than to a guess. Two equipped weapons and
 * no declaration naming one is a question this cannot answer, and picking the
 * first in the collection would silently apply one dagger's speed factor to a
 * two-handed sword's swing.
 * @param {object} options - The lookup context.
 * @param {Actor|null} options.actor - The combatant's actor.
 * @param {object|null} options.declaration - What they said they would do.
 * @returns {Item|null} The weapon, or null when it cannot be determined.
 */
export const weaponFor = ({ actor, declaration }) => {
  if (!actor) return null

  const named = declaration?.itemId ? actor.items.get(declaration.itemId) : null
  if (named?.type === "weapon") return named

  const equipped = actor.items.filter(
    (item) => item.type === "weapon" && item.system?.isEquipped,
  )

  return equipped.length === 1 ? equipped[0] : null
}

/**
 * Work out how many times a combatant attacks this round, and why.
 *
 * **A weapon's rate of fire and a character's attacks per round are
 * alternatives, not factors.** A fighter entitled to two attacks does not get
 * four with a bow that looses twice; the bow's rate is the answer for as long as
 * they are shooting it. So the weapon governs a declared missile attack, and the
 * character governs everything else.
 *
 * The rate returned may be fractional -- 3/2 means three attacks across two
 * rounds -- because turning that into a whole number depends on which round it
 * is, which is `attackCountFor`'s job rather than this one's.
 * @param {object} options - The lookup context.
 * @param {Actor|null} options.actor - The combatant's actor.
 * @param {object|null} options.declaration - What they said they would do.
 * @param {object} [options.declarationType] - The resolved declaration record.
 * @returns {{rate: number, source: string, weapon: Item|null}} The rate, where
 * it came from, and the weapon it was read from if any.
 */
export const resolveAttackRate = ({ actor, declaration, declarationType }) => {
  const weapon = weaponFor({ actor, declaration })
  const isMissile = declarationType?.id === "bags.missile"
  const rateOfFire = weapon?.system?.rateOfFire

  if (isMissile && Number.isFinite(rateOfFire) && rateOfFire > 0) {
    return { rate: rateOfFire, source: RATE_SOURCE.WEAPON, weapon }
  }

  const attacksPerRound = actor?.system?.base?.attacksPerRound
  if (Number.isFinite(attacksPerRound) && attacksPerRound > 0) {
    return { rate: attacksPerRound, source: RATE_SOURCE.ACTOR, weapon }
  }

  return { rate: 1, source: RATE_SOURCE.DEFAULT, weapon }
}

/**
 * How many segments the weapon in hand adds to its wielder's initiative.
 *
 * Zero when no weapon can be identified, which is the honest answer: guessing
 * would mean applying some other weapon's speed to this swing.
 * @param {object} options - The lookup context.
 * @param {Actor|null} options.actor - The combatant's actor.
 * @param {object|null} options.declaration - What they said they would do.
 * @returns {number} Segments to add.
 */
export const speedFactorFor = ({ actor, declaration }) => {
  const speed = weaponFor({ actor, declaration })?.system?.speedFactor
  return Number.isFinite(speed) ? speed : 0
}
