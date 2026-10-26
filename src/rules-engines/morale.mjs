/**
 * @file Works out when monsters must check morale, and whether a check fails.
 *
 * Every game BAGS models has monsters check morale when a fight turns against
 * them. Two moments are common to all of them, and they are the two built
 * here:
 *
 * - **An important death.** Some monsters -- a leader, a champion -- shake the
 *   rest when they fall. A monster marked "causes morale checks on death"
 *   triggers a check for its allies when it is defeated.
 * - **Half down.** Once half of a group has been defeated, the rest check.
 *
 * Each moment triggers once per fight for each group. A side that has already
 * held its nerve at half strength does not check again every round after.
 *
 * A check fails when the dice roll *over* the monster's morale rating. A
 * rating of 12 on 2d6 therefore never fails, which is what B/X means by
 * "fights to the death".
 *
 * Pure functions with no Foundry dependencies, so they can be tested without a
 * running game.
 */

/**
 * The moments that call for a morale check.
 * @readonly
 * @enum {string}
 */
export const MORALE_TRIGGER = Object.freeze({
  /** A monster whose death shakes its allies has been defeated. */
  DEATH: "death",
  /** Half of the group has been defeated. */
  HALF: "half",
})

/**
 * A group of combatants who check morale together, summarised.
 * @typedef {object} MoraleUnit
 * @property {string} key - Identifies the group across rounds.
 * @property {number} size - Everyone in it, defeated or not.
 * @property {number} defeated - How many of them are defeated.
 * @property {boolean} importantDeath - Whether a defeated member was one whose
 * death calls for a check.
 * @property {boolean} canCheck - Whether anyone left in it could roll. A group
 * of player characters, or one where everyone is down, has nobody to check.
 */

/**
 * A morale check that is owed.
 * @typedef {object} MoraleTriggered
 * @property {string} unit - The key of the group that must check.
 * @property {string} trigger - One of MORALE_TRIGGER.
 * @property {string} key - `unit:trigger`, recorded so it never fires twice.
 */

/**
 * Find the morale checks that have just become due.
 * @param {MoraleUnit[]} units - Every group that could check.
 * @param {string[]} [fired] - Keys of checks already triggered this fight.
 * @returns {MoraleTriggered[]} The checks newly owed, in the order given.
 */
export const moraleTriggers = (units, fired = []) =>
  units.flatMap((unit) => {
    if (!unit.canCheck) return []

    const triggers = []
    if (unit.importantDeath) triggers.push(MORALE_TRIGGER.DEATH)
    if (unit.size > 0 && unit.defeated * 2 >= unit.size) {
      triggers.push(MORALE_TRIGGER.HALF)
    }

    return triggers
      .map((trigger) => ({
        unit: unit.key,
        trigger,
        key: `${unit.key}:${trigger}`,
      }))
      .filter((due) => !fired.includes(due.key))
  })

/**
 * Does a morale roll fail?
 * @param {number} total - What the dice showed.
 * @param {number} rating - The monster's morale rating.
 * @returns {boolean} True when the roll is over the rating.
 */
export const failsMorale = (total, rating) =>
  Number.isFinite(total) && Number.isFinite(rating) && total > rating
